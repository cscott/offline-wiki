import sys
f = open('500k_popular_articles.txt', 'r')
for line in sys.stdin:
  (title, start, end) = line.split(' ')
  start = int(start)
  end = int(end)
  if end - start > 0:
    f.seek(start)
    print f.read(end - start),
