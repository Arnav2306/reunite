import subprocess
import sys
import os

os.chdir(r"c:\Users\arnav\OneDrive\Reunite Project\backend")
python_exe = sys.executable

print("Python:", python_exe)
print("Running: manage.py check")
print("---")

result = subprocess.run(
    [python_exe, "manage.py", "check"],
    capture_output=True,
    text=True
)

print("EXIT CODE:", result.returncode)
print("=== STDOUT ===")
print(result.stdout)
print("=== STDERR ===")
print(result.stderr)
