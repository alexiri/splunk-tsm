#!/bin/bash -x

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOOKUP="$DIR/../lookups/tsmcode-desc.csv"

echo "tsmcode,description" > $LOOKUP
sed -n '
/TSMMSG/,$ { 
    /^-\{72\}$/,/^$/ {
        /^-\{72\}$/ b
        s/"/'\''/g
        s/^\(AN[ERS][0-9]\{4\}[IESWKD]\)\s\+\(.*\)$/\1,"\2/
        s/^\s\+/ /
        p
    }
}
' $1 | awk '{ printf( "%s", $0 ); if ( $0 ~ /^$/ ){ printf("\"\n"); } }' >> $LOOKUP
