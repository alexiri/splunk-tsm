<html>
<head>
<style type="text/css">
    table {
        border-collapse: collapse;
        border: 1px solid black;
    }
    td,th {
        padding: 5px 12px 5px 12px;
        vertical-align: top;
        border: 1px solid black;
    }
</style>
</head>
<body>

<p><b>${severity}:</b> Detected ${numevents} of type '${search_name}'.</p>

% if description:
<p>${description}</p>
% endif

<p>
${events}
</p>

% if error_help:
<hr/>
<p>
TSM help: <br/>
${error_help}
</p>
% endif

<hr/>
% if context_url:
<p><ul>
  <li><a href="${context_url}">Context</a> of the alert</li>
</ul></p>
% endif

</body>
</html>
