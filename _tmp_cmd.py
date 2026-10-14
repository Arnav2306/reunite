import sys
with open(r"C:\Users\arnav\OneDrive\Reunite Project\cmd_output.txt", "w") as f:
    f.write("PYTHON RAN OK\n")
    f.write("Python version: " + sys.version + "\n")
    try:
        import django
        f.write("Django version: " + django.get_version() + "\n")
    except Exception as e:
        f.write("Django import error: " + repr(e) + "\n")
