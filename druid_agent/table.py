'''
Created on Jul 2, 2012

@author: Daniele Kruse, Alex Iribarren
'''

import config
import os

class Table(object):

    _TABLE  = None
    _TSM_FIELDS  = []
    _VERSION = 1
    _DATA   = []

    def __init__(self, table):
        '''
        Constructor
        '''
        self._TABLE = table.upper()
        self._TSM_FIELDS = config.columns[self._TABLE]['columns']
        self._VERSION = int(config.columns[self._TABLE]['version'])

    def getSQLQuery(self):
        if not self._TSM_FIELDS:
            return None

        return 'SELECT %s FROM %s' % (','.join(self._TSM_FIELDS), self._TABLE)

    def readFromServer(self, server, timedate_string):
        sql = self.getSQLQuery()
        self._DATA = []
        if sql:
            # print sql
            out = server.run(sql)
            if out:
                for row in out:
                    data = [str(x) if x else '' for x in row]
                    data.insert(0, timedate_string)
                    self._DATA.append(data)
                print '[%s] Read %d records from %s' % (server.name, len(self._DATA), self._TABLE)
            else:
                print '[%s] Skipping %s' % (server.name, self._TABLE)
        else:
            print '[%s] Skipping %s' % (server.name, self._TABLE)

    def dumpToFile(self, outputdir, server_name):
        filePath = '%s/%s' % (outputdir, server_name)

        if not os.path.exists(filePath):
            os.makedirs(filePath)

        f = open('%s/%s-%d.log' % (filePath, self._TABLE, self._VERSION), 'a')
        for d in self._DATA:
            f.write('%s\n' % ','.join(['"%s"' % x for x in d]))
        f.close()
