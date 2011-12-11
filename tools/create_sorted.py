import sys
f = open('articles300k.txt', 'r')
for line in sys.stdin:
  (title, start, end) = line.split(' ')
  start = int(start)
  end = int(end)
  if end - start > 0:
    f.seek(start)
    print f.read(end - start),
