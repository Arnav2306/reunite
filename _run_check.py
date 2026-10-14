import subprocess
import sys
import traceback

try:
    python_exe = sys.executable
    result = subprocess.run(
        [python_exe, "manage.py", "check"],
        capture_output=True,
        text=True,
        cwd=r"c:\Users\arnav\OneDrive\Reunite Project\backend"
    )

    output = "=== STDOUT ===\n" + result.stdout + "\n=== STDERR ===\n" + result.stderr + "\n=== EXIT CODE: " + str(result.returncode) + " ==="
except Exception as e:
    output = "SCRIPT ERROR:\n" + traceback.format_exc()

with open(r"C:\Users\arnav\OneDrive\Reunite Project\check_out.txt", "w", encoding="utf-8") as f:
    f.write(output)
