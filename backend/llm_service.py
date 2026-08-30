import json
import re
from datetime import datetime

class LLMManager:
    _instance = None
    
    def __init__(self):
        self.llm = None
        self.model_path = None
        self.enabled = False

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def configure(self, enabled: bool, model_path: str):
        self.enabled = enabled
        if not enabled:
            if self.llm is not None:
                print("LLM Disabled. Unloading model from memory.")
                self.llm = None
                self.model_path = None
            return

        if model_path and model_path != self.model_path:
            try:
                print(f"Loading LLM from {model_path}...")
                # Import here so if llama_cpp is not installed, the app won't crash on startup
                from llama_cpp import Llama
                self.llm = Llama(
                    model_path=model_path,
                    n_ctx=2048,
                    n_threads=4, # Adapt based on typical Mac
                    n_gpu_layers=1 # Use Metal if compiled with it
                )
                self.model_path = model_path
                print("LLM Loaded successfully.")
            except Exception as e:
                print(f"Failed to load LLM from {model_path}: {e}")
                self.llm = None
                self.model_path = None
                self.enabled = False

    def is_ready(self):
        return self.enabled and self.llm is not None

    def extract_information(self, text: str):
        if not self.is_ready():
            return None

        prompt = f"""You are an intelligent assistant for a Chinese government duty office.
Your task is to extract structural information from the following notification text.
Output strictly as a valid JSON object without any additional text.

Current Date and Time for Reference: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Schema:
{{
  "title": "A short and concise summary of the notification (max 15 characters)",
  "sender_dept": "The department sending the notification. Pay special attention to the beginning of the text (e.g., '管理科通知' means '管理科'). Infer if implicit.",
  "contact_person": "Contact person's name AND their phone number (e.g. '张三 13800138000'). You MUST include the phone number if it exists in the text.",
  "event_start": "YYYY-MM-DD HH:MM:SS format, or null if no time. Resolve relative dates like '明天' (tomorrow), '下午2:30' based on the Current Date. E.g., '{datetime.now().strftime('%Y-%m-%d')} 14:30:00'.",
  "event_end": "YYYY-MM-DD HH:MM:SS format for the end of the time range, or null if it's not a range"
}}

Notification text:
"{text}"

JSON:
"""
        try:
            response = self.llm(
                prompt,
                max_tokens=256,
                stop=["}"],
                temperature=0.1
            )
            raw_output = response["choices"][0]["text"].strip()
            
            # Since stop is '}', it might miss the closing bracket
            if not raw_output.endswith("}"):
                raw_output += "}"
                
            # Clean up potential markdown formatting like ```json
            raw_output = re.sub(r'```json\s*', '', raw_output)
            raw_output = re.sub(r'```\s*', '', raw_output)

            parsed = json.loads(raw_output)
            return parsed
        except Exception as e:
            print(f"LLM extraction error: {e}")
            return None
