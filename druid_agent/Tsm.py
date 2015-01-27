#!/usr/bin/env python
import os, re

# Use the Python 3.2 version of the subprocess module, which is recommended
import warnings
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    import subprocess32 as subprocess

class UnknownServerException(Exception):
    pass

class Tsm(object):
    """Execute commands on a TSM server and get the result and return value. There's
    no need to escape quotes in the command, it will be handled internally.

    The return value (stored in `ret` attribute) is 0 upon successful completion.

    Useful attributes:
      `server`: The server to execute commands on.
      `command`: The command to execute.
      `ret`: The return code of the execution, None if nothing was executed.
      `raw`: The raw output of the command.
      `sraw`: The raw output, split by newlines.
      `output`: The parsed output of the command.
      `header`: The headers of the session (version numbers, etc.).

    The output will be a multi-dimensional array if the command finished successfully,
    otherwise it will be an array of strings (one per line of output).

    >>> from Tsm import Tsm
    >>> tsm41 = Tsm('tsm41', 'q ses')
    >>> print tsm41.output
    [['36,775', 'Tcp/Ip', 'Run', '0 S ', '127', '165', 'Admin', 'Linux86', 'ALEX']]
    >>> tsm41.run("select contact from nodes where node_name='PCDS19'")
    0
    >>> print tsm41.raw
    IBM Tivoli Storage Manager
    Command Line Administrative Interface - Version 6, Release 1, Level 4.0
    (c) Copyright by IBM Corporation and other(s) 1990, 2010. All Rights Reserved.

    Session established with server TSM41: Linux/x86_64
      Server Version 5, Release 5, Level 4.1
      Server date/time: 01/31/2011 19:22:36  Last access: 01/31/2011 19:22:36

    ANS8000I Server command: 'select contact from nodes where node_name='PCDS19''
    Alex.Iribarren

    ANS8002I Highest return code was 0.
    >>> tsm41.run('select node_name, contact from nodes where node_name like "PCITDS%"')
    0
    >>> if tsm41.ret == 0:
    ...     print tsm41.output
    ... else:
    ...     print "Error:"
    ...     print "\\n".join(tsm41.output)
    ...
    [['PCDS19', 'alex.iribarren'], ['PCDS19', 'Alex.Iribarren']]
    """

    __dsmadmc  = '/usr/bin/dsmadmc'

    __username = None
    __password = None
    __pwfile   = None


    def __init__(self, server, command = None, username = None, password = None, pwfile = None):
        """Define a new server object.
        If you specify a command as well, the command will be executed immediately.
        """

        if pwfile:
            self.__pwfile = pwfile
        else:
            self.__pwfile = '%s/.tsmtoolsrc' % os.getenv('HOME')

        if username:
            self.__username = username
        else:
            self.__username = os.getlogin()

        if password:
            self.__password = password
        else:
            self.__password = self.__getpassword()

        self.server     = server.upper()
        self.command    = command

        if command:
            self.run()
        else:
            # Just to check that the server exists...
            self.run('quit')


    def __getpassword(self):
        try:
            pwfile   = open(self.__pwfile)
            password = pwfile.readline().strip()
            pwfile.close()
        except IOError:
            password = None

        if not password:
            raise StandardError, "You need to have your TSM admin password in a file called %s" % self.__pwfile

        return password


    def run(self, command = None):
        """Run a command on the server and process the output."""

        if command:
            self.command = command
        # Replace quotes in the command to make sure it's parsed properly
        self.command = self.command.replace('"', "'")

        tmppath = os.getenv('TMPDIR')
        if not tmppath:
            tmppath = '/tmp/'

        cmd = []
        cmd.append(self.__dsmadmc)
        cmd.append('-id=%s' % self.__username)
        cmd.append('-pa=%s' % self.__password)
        cmd.append('-se=%s' % self.server)
        cmd.append('-errorlogname=%s/dsmerror.log' % tmppath)
        cmd.append('-tab')
        cmd.append(self.command)

        # Assume returncode 0
        self.ret = 0
        try:
            self.raw = subprocess.check_output(cmd, stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError, e:
            # Called failed, but let's process the output anyway
            self.raw = e.output
            self.ret = e.returncode

            if e.returncode == 255:
                # Server not in dsm.sys file
                raise UnknownServerException('server %s not found in System Options File' % self.server)

        self.header = []
        self.output = []

        self.sraw = self.raw.split('\n')
        lines = len(self.sraw)
        line  = 0

        # First lets grab the headers, just in case
        while line < lines:
            if re.match('^ANS8000I', self.sraw[line]) or re.match('^ANS1017E', self.sraw[line]):
                break
            self.header.append(self.sraw[line].strip())
            line += 1
        # Remove the last line if it was blank
        if not self.header[-1]:
            self.header.pop()

        # Skip the blank line
        line += 1

        # Now lets get the actual output
        while line < lines:
            if re.match('^ANS8\d{3}I', self.sraw[line]):
                break
            self.output.append(self.sraw[line])
            line += 1
        # Remove the last line if it was blank
        if self.output and not self.output[-1]:
            self.output.pop()

        # If the output is ok, let's split it by tabs
        if self.ret == 0:
            self.output = [x.split('\t') for x in self.output]

        return self.ret

