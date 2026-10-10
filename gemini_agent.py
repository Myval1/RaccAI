import os
import subprocess
from pathlib import Path
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# Set the working directory strictly to where this script is located
BASE_DIR = Path(__file__).parent.resolve()

client = genai.Client()


def safe_path(target_path: str) -> Path:
    """Verifies that the requested path lies strictly inside our allowed directory."""
    resolved = (BASE_DIR / target_path).resolve()
    if not str(resolved).startswith(str(BASE_DIR)):
        raise PermissionError(
            f"Access denied! The path '{target_path}' is outside the allowed directory."
        )
    return resolved


# --- STRICTLY BOUND LOCAL TOOLS ---


def create_local_file(filename: str, content: str) -> str:
    """Creates a file ONLY inside the agent's working directory."""
    try:
        target = safe_path(filename)
        with open(target, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully created file: {target.name}"
    except Exception as e:
        return f"Error creating file: {str(e)}"


def run_folder_command(command: str) -> str:
    """Executes a terminal command with the current working directory (cwd) strictly locked to our folder."""
    confirm = input(
        f"\n[SECURITY ALERT] Allow command '{command}' in folder {BASE_DIR.name}? (y/n): "
    )
    if confirm.lower() != "y":
        return "Command execution cancelled by the user."

    try:
        # cwd=BASE_DIR ensures commands only execute inside this directory
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            cwd=BASE_DIR,
        )
        return (
            result.stdout
            if result.stdout
            else (result.stderr if result.stderr else "Command executed.")
        )
    except Exception as e:
        return f"Execution error: {str(e)}"


# --- GEMINI INITIALIZATION ---

chat = client.chats.create(
    model="gemini-3.5-flash-lite",
    config=types.GenerateContentConfig(
        system_instruction=(
            f"You are a sandboxed assistant. You have access ONLY to the directory: {BASE_DIR}. "
            "You must not access or modify files outside this directory."
        ),
        tools=[create_local_file, run_folder_command],
        temperature=0.2,
    ),
)

print(f"🤖 Local Agent Ready! All actions are locked inside:\n📍 {BASE_DIR}\n")

while True:
    user_input = input("You: ")
    if user_input.lower() in ["exit", "quit"]:
        break

    response = chat.send_message(user_input)

    while response.function_calls:
        for call in response.function_calls:
            fn_name = call.name
            args = call.args

            if fn_name == "create_local_file":
                output = create_local_file(**args)
            elif fn_name == "run_folder_command":
                output = run_folder_command(**args)

            response = chat.send_message(
                types.Part.from_function_response(
                    name=fn_name, response={"result": output}
                )
            )

    print(f"\nGemini: {response.text}\n")