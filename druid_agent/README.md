In this directory you will find the python scripts responsible for gathering data from the TSM database, in order to be used within Splunk.

1. [config.py](config.py) is generated automatically by a homemade script but is basically the list of all TSM DB tables along with their columns. If you are using TSM 6.x this file most probably will work fine as it is, otherwise you need to customize it.
2. [main.py](main.py) contains the main python function responsible for dumping all data with the TSM DB into Splunk usable data. (no need to modify this)
3. [pw](pw) contains the password for the TSM admin account
4. [server.py](server.py) contains the server class resposnbile for fetching the data of a single TSM server and dunping it into a file. (no need to modify this)
5. [subprocess32.py](subprocess32.py) is an external utility to spawn concurrent processes and gather their return codes. (no need to modify this)
6. [table.py](table.py) contains the table class used by [server.py](server.py) to fetch and dump data corresponding to a single table of a single server. (no need to modify this)
7. [Tsm.py](Tsm.py) is the TSM server interface, i.e. it carries out the actual querying of the TSM DB by using the admin console of TSM.
