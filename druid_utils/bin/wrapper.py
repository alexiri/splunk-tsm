#!/opt/splunk/bin/python

# Wrapper script that allows you to execute something else with the system python version
import os, sys
from subprocess import call

NEW_PYTHON = '/usr/bin/python'
MY_PATH    = os.path.dirname(sys.argv[0])

for envvar in ("PYTHONPATH", "LD_LIBRARY_PATH"):
    if envvar in os.environ:
        del os.environ[envvar]

try:
    params = [NEW_PYTHON, '%s/%s' % (MY_PATH, sys.argv[1])]
    params.extend(sys.argv[2:])

    call(params, stdin=sys.stdin)
except Exception,e:
    pass

