import sys
f = open('popular_simple.txt', 'r')
for line in sys.stdin:
  (title, start, end) = line.split(' ')
  start = int(start)
  end = int(end)
  if end - start > 0:
    f.seek(start)
    print f.read(end - start),
