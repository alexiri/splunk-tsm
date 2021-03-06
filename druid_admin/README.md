In this directory you will find the TSM administration application for Splunk.

[default](default) contains the configuration files of the application, they should work without any change. The only thing to note is:

- [macros.conf](default/macros.conf) is highly specific and should be modified in order for it to work correctly especially the part on replication (if you are using node replication).

To adapt this application to your environment you have to mainly modify the xml files contained within the [default/data/ui/views](default/data/ui/views) directory. These files represent the dashboards and the views of the application. Let's see the main things one has to understand in order to modify these files:

- [Asuranceturix.xml](default/data/ui/views/Asuranceturix.xml) is based on the presence of two tape-libraries called "TSMLIB0" and "IBMLIB2", you should modify these names matching your configuration
- [c5_statistics.xml](default/data/ui/views/c5_statistics.xml) is a high level report which is based on the concept of "contact department" and "contact group", in order for it to work properly these should be part of your node information (they can be blank and then there will be just one grouping)
- [daily_traffic.xml](default/data/ui/views/daily_traffic.xml) is based on the same concepts as [c5_statistics.xml](default/data/ui/views/c5_statistics.xml)
- [drive_debug.xml](default/data/ui/views/drive_debug.xml) needs your fiber channel log forwarding working, and might need to be customized for different kinds of logs coming from your fiber channel switches
- [externals.xml](default/data/ui/views/externals.xml) is highly specific, it is based on e-groups (mailing lists) and in the classification of servers in different buildings ("613" and "513") in our case
- [Idefix.xml](default/data/ui/views/Idefix.xml) is the page showing categorized errors and will most probably work as is without any modifications
- [migration_status.xml](default/data/ui/views/migration_status.xml) is showing the status of the migrations from disk to tape and will most probably work as is without any modifications
- [nap_config.xml](default/data/ui/views/nap_config.xml) allows you to specify the "no alert periods" for the nodes, that is the periods in which the user decides not to receive missed schedule warnings, should work as is
- [network.xml](default/data/ui/views/network.xml) shows statistics about the network and uses logs generated by a tool called Lemon which is used internally to monitor the status of all machines in the computer centre, you will most likely need to massage the data (or this XML file) in order to make use of this dashboard
- [node_config.xml](default/data/ui/views/node_config.xml) allows you to configure retirements, backup delays and groups for nodes. This will probably work as is.
- [node_data.xml](default/data/ui/views/node_data.xml) and [node_traffic.xml](default/data/ui/views/node_traffic.xml) show you the total data and traffic stats of your nodes. it will probably work as is.
- [node_info.xml](default/data/ui/views/node_info.xml) shows the info of your nodes. it is based on the concept of "contact department" and "contact group", just like [c5_statistics.xml](default/data/ui/views/c5_statistics.xml).
- [node_logs.xml](default/data/ui/views/node_logs.xml) will probably work fine as is, provided that you activated the client logging feature on your TSM servers.
- [Obelix.xml](default/data/ui/views/Obelix.xml) is the main TSM server detail dashboard. To make it work you should replace BACKUPPOOL and BACKUPCART with the names of your disk pool and tape pool (respectively). The rest should work fine.
- [oracle_restores.xml](default/data/ui/views/oracle_restores.xml) is highly specific and based on the fact that we backup our Oracle databases on specific TSM servers. I would recommend you ignore this file unless you're facing Oracle backup issue, in which case it has to be completely readapted to your environment
- [Ordenalfabetix.xml](default/data/ui/views/Ordenalfabetix.xml) is the list of all nodes registered. It will probably work as is but it is based on the concept of "contact department" and "contact group", just like [c5_statistics.xml](default/data/ui/views/c5_statistics.xml).
- [Panoramix.xml](default/data/ui/views/Panoramix.xml) is the main system health dashboard. In order to adapt it to your environment you should adjust the thresholds that it contains. It based on the concept on some TSM servers being "user servers" and some other being "library managers". it is also based on two tape-libraries called "TSMLIB0" and "IBMLIB2" and on disk pools and tape pools respectively called BACKUPPOOL and BACKUPCART. If you manage to make this page display the information correctly most of the other pages will follow.
- [server_config.xml](default/data/ui/views/server_config.xml) is used to enter information about the TSM servers and will probably work as it is.
- [server_sizes.xml](default/data/ui/views/server_sizes.xml) displays a nice graph showing the sizes (in 3 dimensions) of your TSM servers. It will probably work as is.
- [tape_debug.xml](default/data/ui/views/tape_debug.xml) shows detailed info about tapes, it will probably work as is.
- [tape_mounts.xml](default/data/ui/views/tape_mounts.xml) shows the mounts in a nice chart, it is based on the presence of two tape-libraries called "TSMLIB0" and "IBMLIB2", you may modify it according to your tape environment
- [tape_supply.xml](default/data/ui/views/tape_supply.xml) is as above based on the two libraries. In addition it is based on the presence of scratch tapes used by the library managers, if you don't use scratch tapes, this won't work.
- [total_data.xml](default/data/ui/views/total_data.xml) shows the total data present in TSM. It uses the concept of "contact department" and "contact group" to break down the statistics.
- [tsmdb_index.xml](default/data/ui/views/tsmdb_index.xml) should work as is and it lists the tables available from the TSM servers' databases
- [Vitalstatistix.xml](default/data/ui/views/Vitalstatistix.xml) makes sure the splunk application is running correctly and should work as is.

The file [default.xml](default/data/ui/nav/default.xml) in [default/data/ui/nav](default/data/ui/nav) is the navigation bar configuration and should work as is (unless you want to reshuffle things around).

[appserver](appserver) contains CSS and JavaScript files which can be used as they are.
