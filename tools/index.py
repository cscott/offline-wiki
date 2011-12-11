import sys
action = 0
xtitle = ''
title = ''
ptr = 0
xartstart = 0
artstart = 0
for line in sys.stdin:
  if action == 0 and line.startswith('= '):
    action = 1
    xtitle = line[2:-3]
    xartstart = ptr
  elif action > 0 and action <= 3 and line == '\n':
    action += 1
  elif line != '\n':
    if action == 4:
      print title.replace(" ", "_"), artstart, xartstart
      title = xtitle
      artstart = xartstart
    action = 0
  ptr += len(line)
