/***********************************************************************
* ADSTAR Distributed Storage Manager (adsm)                            *
* Server Component                                                     *
*                                                                      *
* 5639-B9300 (C) Copyright IBM Corporation 1997 (Unpublished)          *
***********************************************************************/

/***********************************************************************
 * Name:            tsmsyslogger.c
 *
 * Description:     Send TSM messages to syslog
 *                  Based on userExitSample.c
 *
 * Environment:     *********************************************
 *                  ** This is a platform-specific source file **
 *                  ** versioned for: Linux                    **
 *                  *********************************************
 *
 ***********************************************************************/

#include <stdio.h>
#include <stdlib.h>
#include "tsmsyslogger.h"
#include <syslog.h>
#include <string.h>

#define FACILITY LOG_USER

char tsmserver[MAX_SERVERNAME_LENGTH+1]  = "\0";
char logident[8+MAX_SERVERNAME_LENGTH+1] = "dsmserv-\0";
char message[ (MAX_MSGTEXT_LENGTH + OUT_MAX_TOKEN_MSG) * 2 + 1] = "\0";

/**************************************
 *** Do not modify below this line. ***
 **************************************/

extern void adsmV3UserExit( void *anEvent );

/************
 *** Main ***
 ************/

int main(int argc, char *argv[])
{
/* Do nothing, main() is never invoked, but stub is needed */

exit(0);  /* For picky compilers */

} /* End of main() */

void cleanup() {
  closelog();
}

void err_exit(char *msg) {
  printf("FATAL: %s\n",msg);

  cleanup();
  exit(2);
}

void concatIfDefined(char *str, const char *label, const uchar *field) {
  if ( field != NULL && strcmp((char *)field, "") != 0 ) {
    strcat(str, label);
    strcat(str, (char *)field);
  }
}


/******************************************************************
 * Procedure:  adsmV3UserExit
 * If the user-exit is specified on the server, a valid and
 * appropriate event will cause an elEventRecvData structure
 * (see userExitSample.h) to be passed to a procedure named
 * adsmV3UserExit that returns a void.
 *
 * INPUT :   A (void *) to the elEventRecvData structure
 * RETURNS:  Nothing
 ******************************************************************/

void adsmV3UserExit( void *anEvent )
{
  /* Typecast the event data passed */
  elEventRecvData *eventData = (elEventRecvData *)anEvent;

  /**************************************
   *** Do not modify above this line. ***
   **************************************/

  if( ( eventData->eventNum == USEREXIT_END_EVENTNUM     ) ||
    ( eventData->eventNum == END_ALL_RECEIVER_EVENTNUM ) ) {
    /* Server says to end this user-exit.  Perform any cleanup, *
     * but do NOT exit() !!!                                    */
    cleanup();
    return;
  }

  /* Field Access:  eventData->.... */
  /* Your code here ... */

  /* Be aware that certain function calls are process-wide and can cause
   * synchronization of all threads running under the TSM Server process!
   * Among these is the system() function call.  Use of this call can
   * cause the server process to hang and otherwise affect performance.
   * Also avoid any functions that are not thread-safe.  Consult your
   * system's programming reference material for more information.
   */

  if ( tsmserver == NULL || strcmp((char *)eventData->serverName, tsmserver) != 0 ) {
    if ( tsmserver != NULL ) {
        cleanup();
    }

    strcpy(tsmserver, (char *)eventData->serverName);
    strcat(logident, tsmserver);

    openlog(logident, LOG_NDELAY, FACILITY);
  }

  strcpy(message, (char *)eventData->event);

  concatIfDefined(message, " node=", eventData->nodeName);
  concatIfDefined(message, " owner=", eventData->ownerName);
  concatIfDefined(message, " client_host=", eventData->hlAddress);
  //concatIfDefined(message, " client_port=", eventData->llAddress); // Not really interesting...
  concatIfDefined(message, " schedule=", eventData->schedName);

  // Clean up the message to remove crappy ~ symbols
  int i;
  for (i = 0; i < strlen(message); i++) {
    if (message[i] == '~') {
        message[i] = ' ';
    }
  }

  int priority;
  switch ( eventData->sevCode )
  {
    case ADSM_SEV_INFO       : priority = LOG_INFO; break;
    case ADSM_SEV_WARNING    : priority = LOG_WARNING; break;
    case ADSM_SEV_ERROR      : priority = LOG_ERR; break;
    case ADSM_SEV_SEVERE     : priority = LOG_ALERT; break;
    case ADSM_SEV_DIAGNOSTIC : priority = LOG_DEBUG; break;
    default                  : priority = LOG_INFO; break;
  }
  syslog(priority, "%s", message);

  return; /* For picky compilers */
} /* End of adsmV3UserExit() */
