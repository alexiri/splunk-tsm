<%inherit file="/basic_msg.tpl" />


<%def name="title()">
Escalation for failed backups
</%def>

<%def name="contents()">
<%
from datetime import datetime

def toInt(n):
    try:
        return str(int(float(n)))
    except (TypeError, ValueError):
        return n

def toDateStr(d):
    try:
        return datetime.fromtimestamp(float(d)).strftime('%Y-%m-%d %H:%M:%S')
    except (TypeError, ValueError):
        return d

%>
    % if nodes:
    <p><b class="red">${len(nodes)}</b> nodes with missed scheduled > ${escalation_date} days. <a href="#nodes">(full list below)</a></p>
    % endif
    % if filespaces:
    <p><b class="red">${len(filespaces)}</b> nodes with missed filespaces > ${escalation_date} days. <a href="#filespaces">(full list below)</a></p>
    % endif

    % if nodes:
    <a name="nodes"></a>
    <h1>Failed Schedules > ${escalation_date} days</h1>
    <table cellspacing="0" cellpadding="0" border="0">
      <tr>
        <th class="left">TSM Server</th>
        <th class="left">Node Name</th>
        <th class="left">Contact</th>
        <th class="left">Schedule</th>
        <th class="left">Status</th>
        <th class="nowrap">Last backup date</th>
        <th>Days since last backup</th>
      </tr>
    % for f in nodes:
      <tr>
        <td class="left">${f['tsmserver']}</td>
        <td class="left">${f['node']}</td>
        <td class="left">${f['CONTACT']}</td>
        <td class="left">${ '<br/>'.join(f['client_schedule']) }</td>
        <td class="left">${ '<br/>'.join(f['status']) }</td>
        <td class="nowrap">${ '<br/>'.join([toDateStr(x) for x in f['last_completed']]) }</td>
        <td>${ '<br/>'.join([toInt(x) for x in f['days_since']]) }</td>
      </tr>
    % endfor
    </table>
    % endif

    % if filespaces:
    <a name="filespaces"></a>
    <h1>Failed filespaces > ${escalation_date} days</h1>
    <table cellspacing="0" cellpadding="0" border="0">
      <tr>
        <th class="left">TSM Server</th>
        <th class="left">Node Name</th>
        <th class="left">Contact</th>
        <th class="left">Filespaces</th>
        <th class="nowrap">Last backup date</th>
        <th>Days since last backup</th>
      </tr>
    % for f in filespaces:
      <tr>
        <td class="left">${f['tsmserver']}</td>
        <td class="left">${f['node']}</td>
        <td class="left">${f['CONTACT']}</td>
        <td class="left">${ '<br/>'.join(f['FILESPACES']) }</td>
        <td class="nowrap">${ '<br/>'.join([toDateStr(x) for x in f['last_completed']]) }</td>
        <td>${ '<br/>'.join([toInt(x) for x in f['days_since']]) }</td>
      </tr>
    % endfor
    </table>
    % endif
</%def>
