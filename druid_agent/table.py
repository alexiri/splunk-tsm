'''
Created on Jul 2, 2012

@author: Daniele Kruse, Alex Iribarren
'''

import config
import os
import logging
import operator

class Table(object):

    _TABLE  = None
    _TSM_FIELDS  = []
    _VERSION = 1
    _DATA   = []

    def __init__(self, table):
        '''
        Constructor
        '''
        self.log = logging.getLogger('Table')
        self._TABLE = table.upper()

        data = config.columns[self._TABLE]['data']
        versions = sorted(data, key=operator.itemgetter('version'), reverse=True)

        for v in versions:
            if config.version >= int(v['version']):
                self._TSM_FIELDS = v['columns']
                self._VERSION = int(v['version'])
                break

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
                self.log.info('[%s] Read %d records from %s (v%d)' % (server.name, len(self._DATA), self._TABLE, self._VERSION))
            else:
                self.log.warning('[%s] Skipping %s (v%d)' % (server.name, self._TABLE, self._VERSION))
        else:
            self.log.warning('[%s] Skipping %s (v%d)' % (server.name, self._TABLE, self._VERSION))

    def dumpToFile(self, outputdir, server_name):
        filePath = '%s/%s' % (outputdir, server_name)

        if not os.path.exists(filePath):
            os.makedirs(filePath)

        f = open('%s/%s-%d.log' % (filePath, self._TABLE, self._VERSION), 'a')
        for d in self._DATA:
            f.write('%s\n' % ','.join(['"%s"' % x for x in d]))
        f.close()
