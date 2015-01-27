# Splunk app for TSM

Here you'll find a collection of things you might find useful for monitoring a Tivoli Storage Manager installation with Splunk.

### WARNING
This code is highly tailored to our needs and includes integration for many things you don't care about
and it may be completely broken outside of our environment. It has virtually no documentation and
is not guaranteed to do anything at all. Feel free to ask questions, but note that this code is
provided **as is**. We are not affiliated with IBM or Splunk and all trademarks belong to their
respective owners. **Proceed at your own risk!**

Here's a short description of what each component is:

1. [druid_forwarder](druid_forwarder): the splunkforwarder app to be installed on your TSM servers.
2. [druid_agent](druid_agent): Python script that dumps the TSM server's DB tables into flat files to be ingested by the forwarder.
3. [druid_admin](druid_admin): Administrator dashboard
4. [druid_user](druid_user): User's portal
5. [druid_utils](druid_utils): common elements to the two previous Splunk apps.
6. [edittable](edittable): half-baked Splunk app that allows for editable tables (used in [druid_admin](druid_admin) and [druid_user](druid_user)). Your mileage may vary.

## Requirements
* Splunk version 6.2 or higher
* IBM's Tivoli Storage Manager version 6.0 or higher
* Splunk Gantt Chart visualization (https://apps.splunk.com/app/1741/)
* Splunk DB Connect (https://apps.splunk.com/app/958/)
* python-requests
* python-ldap
* python-argparse
* suds-jurko
* pushybullet (for [Pushbullet](https://www.pushbullet.com/) integration)
