/***********************************************************************
* ADSTAR Distributed Storage Manager (adsm)                            *
* Server Component                                                     *
*                                                                      *
* 5639-B9300 (C) Copyright IBM Corporation 1997 (Unpublished)          *
***********************************************************************/

/***********************************************************************
 * Name:            tsmsyslogger.h
 *
 * Description:     Declarations for a user-exit
 *
 * Environment:     *********************************************
 *                  ** This is a platform-specific source file **
 *                  ** versioned for: Linux                    **
 *                  *********************************************
 *
 ***********************************************************************/

#ifndef _H_USEREXITSAMPLE
#define _H_USEREXITSAMPLE

#include <stdio.h>
#include <sys/types.h>

/**************************************
 *** Do not modify below this line. ***
 **************************************/

#define BASE_YEAR       1900

typedef short		int16;
typedef int		int32;
typedef unsigned char	uchar;

/* DateTime Structure Definitions - ADSM representation of a timestamp */

typedef struct
{
  uchar 	year;		/* Years since BASE_YEAR (0-255) */
  uchar		mon;		/* Month (1 - 12)		 */
  uchar 	day;		/* Day (1 - 31)			 */
  uchar		hour;		/* Hour (0 - 23)		 */
  uchar		min;		/* Minutes (0 - 59)		 */
  uchar		sec;		/* Seconds (0 - 59)		 */
} DateTime;

/******************************************
 * Some field size definitions (in bytes) *
 ******************************************/

#define MAX_SERVERNAME_LENGTH	  64
#define MAX_NODE_LENGTH		  64
#define MAX_COMMNAME_LENGTH	  16
#define MAX_OWNER_LENGTH	  64
#define MAX_HL_ADDRESS		  64
#define MAX_LL_ADDRESS		  32
#define MAX_SCHED_LENGTH	  30
#define MAX_DOMAIN_LENGTH	  30
#define MAX_MSGTEXT_LENGTH	1600
/* contant for max token length */
#define OUT_MAX_TOKEN_MSG   40

/**********************************************
 * Event Types (in elEventRecvData.eventType) *
 **********************************************/

#define ADSM_SERVER_EVENT       0x03  /* Server Events */
#define ADSM_CLIENT_EVENT       0x05  /* Client Events */

/***************************************************
 * Application Types (in elEventRecvData.applType) *
 ***************************************************/

#define ADSM_APPL_BACKARCH    1  /* Backup or Archive client          */
#define ADSM_APPL_HSM         2  /* Space manage client               */
#define ADSM_APPL_API         3  /* API client                        */
#define ADSM_APPL_SERVER      4  /* Server (ie. server to server )    */

/*****************************************************
 * Event Severity Codes (in elEventRecvData.sevCode) *
 *****************************************************/

#define ADSM_SEV_INFO         0x02     /* Informational message.        */
#define ADSM_SEV_WARNING      0x03     /* Warning message.              */
#define ADSM_SEV_ERROR        0x04     /* Error message.                */
#define ADSM_SEV_SEVERE       0x05     /* Severe error message.         */
#define ADSM_SEV_DIAGNOSTIC   0x06     /* Diagnostic message.           */
#define ADSM_SEV_TEXT         0x07     /* Text message.                 */

/************************************************************
 * Data Structure of Event that is passed to the User-Exit. *
 *                                                          *
 * This data structure is the same for a file generated via *
 *    FILEEXIT option on the server.                        *
 ************************************************************/

typedef struct evRdata
{
  int32    eventNum;             /* the event number.                    */
  int16    sevCode;              /* event severity.                      */
  int16    applType;             /* application type (hsm, api, etc)     */
  int32    sessId;               /* session number                       */
  int32    version;              /* Version number of this structure (2) */
  int32    eventType;            /* event type                              *
                                  * (ADSM_CLIENT_EVENT, ADSM_SERVER_EVENT)  */
  DateTime timeStamp;            /* timestamp for event data.            */
  uchar    serverName[MAX_SERVERNAME_LENGTH+1]; /* server name           */
  uchar    nodeName[MAX_NODE_LENGTH+1]; /* Node name for session         */
  uchar    commMethod[MAX_COMMNAME_LENGTH+1]; /* communication method    */
  uchar    ownerName[MAX_OWNER_LENGTH+1];     /* owner                   */
  uchar    hlAddress[MAX_HL_ADDRESS+1];       /* high-level address      */
  uchar    llAddress[MAX_LL_ADDRESS+1];       /*  low-level address      */
  uchar    schedName[MAX_SCHED_LENGTH+1]; /* schedule name if applicable */
  uchar    domainName[MAX_DOMAIN_LENGTH+1]; /* domain name for node      */
  uchar    event[MAX_MSGTEXT_LENGTH + OUT_MAX_TOKEN_MSG + 1];/* event text */
  int16    reserved1;            /* reserved field 1                     */
  int16    reserved2;            /* reserved field 2                     */
  uchar    reserved3[1400];      /* reserved field 3                     */
  int32    sessToken;            /* session number                       */
  int32    procToken;            /* process number                       */
} elEventRecvData;

/************************************
 * Size of the Event data structure *
 ************************************/

#define ELEVENTRECVDATA_SIZE            sizeof(elEventRecvData)

/*************************************
 * User Exit EventNumber for Exiting *
 *************************************/

#define USEREXIT_END_EVENTNUM     1822  /* Only user-exit receiver to exit */
#define END_ALL_RECEIVER_EVENTNUM 1823  /* All receivers told to exit      */

/**************************************
 *** Do not modify above this line. ***
 **************************************/

/********************** Additional Declarations **************************/

#endif
