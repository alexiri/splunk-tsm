'''
Created on Jul 2, 2012

@author: Daniele Kruse, Alex Iribarren
'''

from Tsm import Tsm
from table import Table
import config
import logging

class Server(object):

    _TABLES = []

    def __init__(self, name, outputdir, freq, timedate_string, table_names):
        self.name = name.upper()
        self.outputdir = outputdir
        self.timedate_string = timedate_string
        self.log = logging.getLogger('Server')
        if table_names:
            for t in table_names:
                self._TABLES.append(Table(t))
        else:
            for table in config.columns:
                tfreq = config.columns[table]['frequency']
                if tfreq != 'NEVER' and (freq == 'ALL' or freq == tfreq):
                    self._TABLES.append(Table(table))

    def run(self, query):
        _SERVER = Tsm(self.name, query, username=config.user, pwfile=config.pwfile)
        if _SERVER.ret == 0:
            return _SERVER.output
        elif _SERVER.ret == 11:
            return []
        else:
            self.log.error('[%s] Error reading data: %s' % (self.name, ' '.join(_SERVER.output)))
            return None

    def readData(self):
        for table in self._TABLES:
            table.readFromServer(self, self.timedate_string)

    def writeData(self):
        for table in self._TABLES:
            table.dumpToFile(self.outputdir, self.name)
