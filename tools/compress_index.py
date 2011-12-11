import sys
ptr = 0
last = ''
dt = '0123456789abcefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()`[]{}|/<>,.:;'
for line in sys.stdin:
  count = 0
  for c in range(0, min(len(line), len(last))):
    if last[c] == line[c]:
      count += 1
  last = line
  st = dt[count] + line[count:-1]
  ptr += len(st) + 1
  if ptr > 128:
    last = ''
    ptr = 0
  print st
