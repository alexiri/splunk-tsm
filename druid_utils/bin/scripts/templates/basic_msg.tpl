<html>
 <head>
  <title>${next.title()}</title>
  <style type="text/css">
    body,table {
        font-family: Arial, Helvetica;
        font-size: 12px;
    }
    h1 {
        border: solid 1px #003366;
        padding-left: 4px;
        background-color: #f0f0f0;
        font-size: 14px;
    }
    h2 {
        font-size: 13px;
        color: #336699;
        border-bottom: dotted 1px #336699;
    }
    .nopad {
        padding: 0px;
    }
    .nowrap {
        white-space: nowrap;
    }
    td,th {
        padding: 5px 12px 5px 12px;
        text-align: right;
        vertical-align: top;
    }
    .left {
        text-align: left;
    }
    .red {
        color: red;
    }
    .insert {
        background-color: #E6E6E6;
        border: 1px;
        border-top-style: dashed;
        border-bottom-style: dashed;
    }
    .insert-left {
        background-color: #E6E6E6;
        border: 1px;
        border-top-style: dashed;
        border-bottom-style: dashed;
        border-left-style: dashed;
        text-align: left;
    }
    .insert-right {
        background-color: #E6E6E6;
        border: 1px;
        border-top-style: dashed;
        border-bottom-style: dashed;
        border-right-style: dashed;
    }
  </style>
 </head>
<body>
 <div>
    ${next.contents()}
 </div>
</body>
</html>
