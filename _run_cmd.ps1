$python = "C:\Users\arnav\AppData\Local\Programs\Python\Python314\python.exe"
$outFile = "C:\Users\arnav\OneDrive\Reunite Project\cmd_output.txt"
$errFile = "C:\Users\arnav\OneDrive\Reunite Project\cmd_error.txt"

"=== Running python check ===" | Out-File $outFile -Encoding utf8

$proc = Start-Process -FilePath $python -ArgumentList "C:\Users\arnav\OneDrive\Reunite Project\_tmp_cmd.py" -RedirectStandardOutput $outFile -RedirectStandardError $errFile -NoNewWindow -Wait -PassThru
"EXIT CODE: $($proc.ExitCode)" | Out-File $outFile -Append -Encoding utf8
