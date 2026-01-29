#!/bin/bash
# inspect_inhibitors.sh

# Get list of inhibitors (formatted as string)
# format: (['/path/1', '/path/2'],)
raw_list=$(gdbus call --session --dest org.gnome.SessionManager --object-path /org/gnome/SessionManager --method org.gnome.SessionManager.GetInhibitors)

# Extract paths
paths=$(echo $raw_list | grep -o "'[^']*'" | tr -d "'")

for path in $paths; do
    echo "--- Inhibitor: $path ---"
    app_id=$(gdbus call --session --dest org.gnome.SessionManager --object-path $path --method org.gnome.SessionManager.Inhibitor.GetAppId 2>/dev/null)
    reason=$(gdbus call --session --dest org.gnome.SessionManager --object-path $path --method org.gnome.SessionManager.Inhibitor.GetReason 2>/dev/null)
    flags=$(gdbus call --session --dest org.gnome.SessionManager --object-path $path --method org.gnome.SessionManager.Inhibitor.GetFlags 2>/dev/null)
    
    echo "  App: $app_id"
    echo "  Reason: $reason"
    echo "  Flags: $flags"
done
