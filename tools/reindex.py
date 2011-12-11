import sys
action = 0
xtitle = ''
title = ''
ptr = 0
xartstart = 0
artstart = 0
xbody = ''
for line in sys.stdin:
  if action == 0 and line.startswith('= '):
    action = 1
    xtitle = line[2:-3]
    xartstart = ptr
  elif action > 0 and action <= 3 and line == '\n':
    action += 1
  elif line != '\n':
    if action == 4:
      print title.replace(" ", "_")
      title = xtitle
      artstart = xartstart
      xbody = ''
    action = 0
  xbody += line
  ptr += len(line)
