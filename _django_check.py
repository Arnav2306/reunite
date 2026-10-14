import subprocess
import sys
import os

os.chdir(r"c:\Users\arnav\OneDrive\Reunite Project\backend")
python_exe = sys.executable

result = subprocess.run(
    [python_exe, "manage.py", "check"],
    capture_output=True,
    text=True
)

output_parts = []
output_parts.append("=== EXIT CODE: " + str(result.returncode) + " ===")
output_parts.append("=== STDOUT ===")
output_parts.append(result.stdout)
output_parts.append("=== STDERR ===")
output_parts.append(result.stderr)

full_output = "\n".join(output_parts)

with open(r"C:\Users\arnav\OneDrive\Reunite Project\django_result.txt", "w", encoding="utf-8") as f:
    f.write(full_output)

print(full_output)
