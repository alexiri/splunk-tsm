#!/opt/splunk/bin/python
# Wrapper script that allows you to execute BINARY with the system python version
import os, sys
import subprocess

NEW_PYTHON    = '/usr/bin/python'
MY_PATH       = os.path.dirname(sys.argv[0])
SPLUNK_PYTHON = os.environ['PYTHONPATH']
BINARY        = 'checkegroups.py'

del os.environ['LD_LIBRARY_PATH']
os.environ['PYTHONPATH'] = NEW_PYTHON
my_process = os.path.join(MY_PATH, BINARY)

params = [os.environ['PYTHONPATH'], my_process, SPLUNK_PYTHON]
params.extend(sys.argv[1:])

# redirect stderr of the subprocess to have it displayed in splunk
p = subprocess.Popen(params,
                      stdin=subprocess.PIPE, stdout=sys.stdout, stderr=sys.stdout)

p.stdin.write(sys.stdin.read())
p.stdin.flush()
# flush it to the end
p.communicate()
# check the return status
status = p.wait()

# exit with the same return status
sys.exit(status)
