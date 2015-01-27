<%inherit file="/basic_msg.tpl" />

<%def name="title()">
${next.titleEN()}
</%def>

<%def name="contents()">
    <table cellspacing="0" cellpadding="0" border="0">
        <tr>
            <td bgcolor="blue" class="nopad">&nbsp;&nbsp;</td>
            <td bgcolor="white" class="nopad">&nbsp;&nbsp;</td>
            <td bgcolor="red" class="nopad">&nbsp;&nbsp;</td>
            <td class="nopad">&nbsp;<a href="#fr">Version fran&ccedil;aise &agrave; la fin de ce message</a></td>
        </tr>
    </table>

    <h1>${next.titleEN()}</h1>
    ${next.textEN()}

    <h2>Required actions</h2>
    ${next.actionsEN()}

    <h2>Getting help</h2>
    ${next.helpEN()}

    <p>
    Best regards,<br/>
    TSM Support
    </p>

    <br/>

    <a name="fr"></a>
    <h1>${next.titleFR()}</h1>
    ${next.textFR()}

    <h2>Actions requises</h2>
    ${next.actionsFR()}

    <h2>Obtenir de l'aide</h2>
    ${next.helpFR()}

    <p>
    Cordialement,<br/>
    TSM Support
    </p>

    ${next.extras()}

</%def>
