on remote_stop()
end remote_stop

on remote_play()
	tell application id "com.podhomme.airfoil-helper"
		playpause
	end tell
end remote_play

on remote_pause()
	tell application id "com.podhomme.airfoil-helper"
		playpause
	end tell
end remote_pause

on remote_playpause()
	tell application id "com.podhomme.airfoil-helper"
		playpause
	end tell
end remote_playpause

on remote_next_item()
	tell application id "com.podhomme.airfoil-helper"
		seek forward
	end tell
end remote_next_item

on remote_previous_item()
	tell application id "com.podhomme.airfoil-helper"
		seek backward
	end tell
end remote_previous_item

on remote_begin_seek_forward()
	tell application id "com.podhomme.airfoil-helper"
		seek forward
	end tell
end remote_begin_seek_forward

on remote_begin_seek_backward()
	tell application id "com.podhomme.airfoil-helper"
		seek backward
	end tell
end remote_begin_seek_backward

on remote_end_seek()
end remote_end_seek

on remote_volume_up()
end remote_volume_up

on remote_volume_down()
end remote_volume_down

on remote_mute()
end remote_mute

on remote_shuffle()
end remote_shuffle

on remote_restart_item()
end remote_restart_item

on remote_other()
end remote_other
