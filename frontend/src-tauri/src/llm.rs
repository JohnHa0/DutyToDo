use std::sync::mpsc;
use tokio::sync::oneshot;
use std::thread;
use serde_json::Value;
use serde::Deserialize;

pub enum LlmRequest {
    Extract {
        text: String,
        sys_prompt: String,
        reply: oneshot::Sender<Result<Value, String>>,
    },
    Reload {
        model_path: String,
        reply: oneshot::Sender<Result<(), String>>,
    }
}

pub struct LlmState {
    pub tx: std::sync::Mutex<Option<mpsc::Sender<LlmRequest>>>,
}

impl Default for LlmState {
    fn default() -> Self {
        Self {
            tx: std::sync::Mutex::new(None),
        }
    }
}

pub fn start_llm_thread() -> mpsc::Sender<LlmRequest> {
    let (tx, rx) = mpsc::channel::<LlmRequest>();
    
    thread::spawn(move || {
        use llama_cpp_2::llama_backend::LlamaBackend;
        use llama_cpp_2::model::LlamaModel;
        use llama_cpp_2::model::params::LlamaModelParams;
        use llama_cpp_2::context::params::LlamaContextParams;
        use llama_cpp_2::llama_batch::LlamaBatch;
        use llama_cpp_2::token::data_array::LlamaTokenDataArray;

        let backend = match LlamaBackend::init() {
            Ok(b) => b,
            Err(e) => {
                tracing::error!("Failed to init LlamaBackend: {}", e);
                return;
            }
        };

        let mut current_model: Option<LlamaModel> = None;

        while let Ok(req) = rx.recv() {
            match req {
                LlmRequest::Reload { model_path, reply } => {
                    let model_params = LlamaModelParams::default();
                    match LlamaModel::load_from_file(&backend, &model_path, &model_params) {
                        Ok(model) => {
                            current_model = Some(model);
                            let _ = reply.send(Ok(()));
                        }
                        Err(e) => {
                            let _ = reply.send(Err(format!("Failed to load model: {}", e)));
                        }
                    }
                }
                LlmRequest::Extract { text, sys_prompt, reply } => {
                    if current_model.is_none() {
                        let _ = reply.send(Err("大模型尚未成功加载，请检查配置路径是否正确。".to_string()));
                        continue;
                    }

                    let model = current_model.as_ref().unwrap();
                    let ctx_params = LlamaContextParams::default().with_n_ctx(Some(2048.try_into().unwrap()));
                    let mut ctx = match model.new_context(&backend, ctx_params) {
                        Ok(c) => c,
                        Err(e) => {
                            let _ = reply.send(Err(format!("Failed to create context: {}", e)));
                            continue;
                        }
                    };

                    let prompt_str = format!("<|im_start|>system\n{}<|im_end|>\n<|im_start|>user\n通知原文：\n{}\n请严格提取关键信息并仅返回JSON数据对象，绝对不要输出任何解释说明废话。<|im_end|>\n<|im_start|>assistant\n```json\n", sys_prompt, text);
                    let tokens_list = match model.str_to_token(&prompt_str, llama_cpp_2::model::AddBos::Always) {
                        Ok(t) => t,
                        Err(e) => {
                            let _ = reply.send(Err(e.to_string()));
                            continue;
                        }
                    };

                    let mut batch = LlamaBatch::new(2048, 1);
                    let last_index = (tokens_list.len() - 1) as i32;
                    
                    let mut batch_err = None;
                    for (i, token) in (0_i32..).zip(tokens_list.into_iter()) {
                        let is_last = i == last_index;
                        if let Err(e) = batch.add(token, i, &[0], is_last) {
                            batch_err = Some(e.to_string());
                            break;
                        }
                    }

                    if let Some(e) = batch_err {
                        let _ = reply.send(Err(e));
                        continue;
                    }

                    if let Err(e) = ctx.decode(&mut batch) {
                        let _ = reply.send(Err(e.to_string()));
                        continue;
                    }

                    let mut n_cur = batch.n_tokens();
                    let mut output_str = String::new();
                    let mut parsed_value: Option<Value> = None;

                    let max_tokens = n_cur + 500;
                    while n_cur <= max_tokens {
                        let candidates = ctx.candidates_ith(batch.n_tokens() - 1);
                        let mut candidates_p = LlamaTokenDataArray::from_iter(candidates, false);
                        let new_token_id = candidates_p.sample_token_greedy();

                        if new_token_id == model.token_eos() {
                            break;
                        }

                        let token_bytes = model.token_to_piece_bytes(new_token_id, 128, false, None).unwrap_or_default();
                        output_str.push_str(&String::from_utf8_lossy(&token_bytes));

                        // Try parsing JSON progressively to stop early
                        if let Some(start) = output_str.find('{') {
                            let json_slice = &output_str[start..];
                            let mut deserializer = serde_json::Deserializer::from_str(json_slice);
                            if let Ok(value) = serde_json::Value::deserialize(&mut deserializer) {
                                parsed_value = Some(value);
                                break;
                            }
                        }

                        batch.clear();
                        if let Err(_) = batch.add(new_token_id, n_cur, &[0], true) {
                            break;
                        }
                        n_cur += 1;
                        
                        if ctx.decode(&mut batch).is_err() {
                            break;
                        }
                    }

                    if let Some(v) = parsed_value {
                        let _ = reply.send(Ok(v));
                    } else {
                        let _ = reply.send(Err(format!("大模型解析失败或未返回合法的 JSON。模型输出截取：{}", output_str)));
                    }
                }
            }
        }
    });
    
    tx
}
