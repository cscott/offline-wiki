import re, sys
ALLOWED = "frac,nowrap,see,main,convert,-,ipa-en".split(',')
BANNED_SGML = "comment,ref".split(',')
BANNED_SECTIONS = "external links,bibliography,references,further reading".split(',')
def minify(lines):
  reset()
  for line in lines.split('\n'):
    process(line + "\n")
  return postprocess()

def minify_file(lines):
  reset()
  for line in lines:
    process(line)
  return postprocess()


def reset():
  global level, sgml, sgml_level, tmpl, article, outline
  level = 0
  sgml = ""
  sgml_level = 0
  tmpl = ""
  article = "\n\n==$$Begin$$==\n\n"
  outline = ""

def output(s):
  global outline
  outline += s
  if "\n" in outline:
    output_line(outline)
    outline = ''


def output_line(s):
  global article
  s = re.sub("(\n)\n+$", "\1", s)
  if s.strip() != '*':
    article += s

def process(line):
  global level, sgml, sgml_level, tmpl
  last = 0
  line = line.replace('<!--', '<comment>').replace('-->', '</comment>')
  for match in re.finditer(r'\[\[|\]\]|\{\{|\}\}|<[a-zA-Z]+[\s>]|<\/\w+>|\/>', line):
    #print level, match.group()
    if match.group(0) in ['{{', '[[']:
      if sgml == "":
        if level == 0:
          output(line[last:match.start()])
        if level != 0:
          tmpl += line[last:]
        level += 1
        tmpl += match.group(0)
        #print level, line[last:]
    elif match.group(0) in ['}}', ']]']:
      if sgml == "":
        level -= 1
        tmpl += line[last:match.end()]
        if level == 0:
          inner = tmpl.strip()[2:-2]
          if tmpl.strip()[:2] == '{{':
            func = re.match('[^\|\:]+', inner)
            if func:
              func = func.group(0).lower()
              if func in ALLOWED:
                output(tmpl)
              else:
                #print >> sys.stderr, func
                pass
          elif tmpl.strip()[:2] == '[[':
            if re.match(re.compile('[a-z\-]{2,15}:|Images?:|Files?:|Category:|Wikipedia:'), inner) == None:
              output(tmpl)
            else:
              output("%S%P%A%C%E%")
          tmpl = ""
    else:
      #SGML-esque parser
      if "/" in match.group(0):
        sgml_level -= 1
        if len(sgml) > 762 or sgml_level < 0:
          sgml_level = 0
        if sgml_level == 0 and sgml != "":
          #print >> sys.stderr, sgml
          tag = re.match("<\w+", sgml).group(0)[1:].lower()
          if tag not in BANNED_SGML:
            sgml += line[last:match.end()]
            sgml = re.sub('<ref[^\0]*?\/(ref)?\>', '', sgml)
            #print >> sys.stderr, sgml
            sgml = re.sub('<comment>.*?<\/comment>', '', sgml)
            if level == 0:
              output(sgml)
            #output(sgml[:sgml.find('>')+1])
            #smart_filter([sgml[sgml.find('>')+1:sgml.rfind('<')]])
            #output(sgml[sgml.rfind('<'):])
          else:
            output("%S%P%A%C%E%")
          sgml = ""
      else:
        sgml_tag = match.group(0)[1:].replace('>', '').strip()
        if sgml_tag not in ['br', 'small','li']:
          sgml_level += 1
          if sgml == "":
            if level == 0:
              #print last, match.start()
              output(line[last:match.start()])

            sgml = match.group(0)
            last = match.end()
            #print "Opening", sgml
      #print level, sgml_level
    if sgml == "":
      last = match.end()
    #print level
  if level == 0 and sgml == "":
    output(line[last:])
  if level != 0 and sgml == "":
    tmpl += line[last:]
  if sgml != "":
    sgml += line[last:]

def postprocess():
  global article, BANNED_SECTIONS
  output("\n")
  last_num = 0
  last_index = 0
  last_title = ''
  buf = ''
  article += '\n\n==$$End$$==\n\n'
  article = article.replace("%S%P%A%C%E%%S%P%A%C%E%", "%S%P%A%C%E%").replace("\n%S%P%A%C%E% ", "\n")
  article = re.sub("\n%S%P%A%C%E%\n", "\n", article).replace("%S%P%A%C%E%", "")
  for match in re.finditer(r'\n(=+)(.*?)=+\s*?\n', article):
    num = len(match.group(1))
    artpart = article[last_index:match.start()].strip()
    if (len(artpart) != 0 or num > last_num) and last_title.strip().replace('=','').lower() not in BANNED_SECTIONS:
      buf += (last_title)
      buf += (artpart)
    if match.group(2) != '$$Begin$$':
      last_title = match.group(0)
    last_index = match.end()
    last_num = num
  return buf
