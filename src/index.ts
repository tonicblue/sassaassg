import FS from 'fs';
import Path from 'path';
import Gonzales, { Node } from 'gonzales-pe';
import { Marked } from 'marked';
import Dedent from 'dedent';

type DomNode = [
  openTag: string,
  ...children: (DomNode | string)[],
  closingTag: string,
];
type DomNodeStack = [level: number, node: DomNode][];

runTests();

export function runTests () {
  const scssFilesDirectory = Path.join(import.meta.dir, '..', 'scss-tests');
  console.log(`Loading test .scss files from ${scssFilesDirectory}`);

  const scssFiles = FS.readdirSync(scssFilesDirectory);

  for (const scssFile of scssFiles)
    if (scssFile.endsWith('.scss'))
      parseFile(Path.join(scssFilesDirectory, scssFile));
}



export function parseFile (path: string) {
  const basename = Path.basename(path, '.scss');
  const dirname = Path.dirname(path);
  const outputHtmlPath = Path.join(dirname, `${basename}.html`);
  const outputAstPath = Path.join(dirname, `${basename}.json`);

  console.log(`Parsing file ${path} -> ${basename}.html & ${basename}.json`);

  const scss = FS.readFileSync(path).toString();
  const [html, ast] = parse(scss, true);
  const astJson = ast.toJson();

  FS.writeFileSync(outputHtmlPath, html);
  FS.writeFileSync(outputAstPath, astJson);

  return [html, ast];
}



export function parse (scss: string, indent = false): [string, Node] {
  const ast = Gonzales.parse(scss, { syntax: 'scss' });
  const marked = new Marked();
  const domRoot: DomNode = ['', ''];
  const domNodeStack: DomNodeStack = [[0, domRoot]];

  ast.traverse((node, index, parent, level) => {
    const [parentLevel, parentNode] = domNodeStack[domNodeStack.length - 1];

    const domNode = getDomNode(node, marked);
    if (domNode) {
      parentNode.splice(parentNode.length - 1, 0, domNode);

      if (typeof domNode !== 'string') domNodeStack.push([level, domNode]);
    }

    if (level <= parentLevel) domNodeStack.pop();
  });

  const html = (
    indent
      ? recursiveFlatten(domRoot)
      : flatten(domRoot)
  );

  return [html, ast];
}



function getDomNode (node: Node, marked: Marked) {
  const commentDomNode = (
    getSinglelineCommentDomNode(node) ||
    getMultilineCommentDomNode(node, marked)
  );

  if (commentDomNode) return commentDomNode;

  if (!node.is('ruleset')) return;

  const selector = node.first('selector');
  const typeSelector = selector?.first('typeSelector');
  const ident = typeSelector?.first('ident');
  const tag = ident?.content as string;

  if (!selector || !typeSelector || ! ident || !tag) return;

  const attributes: string[] = [];

  selector.forEach('attributeSelector', (node) => {
    const name = node.first('attributeName')?.first('ident')?.content;
    const value = node.first('attributeValue')?.first('string')?.content;

    if (typeof name !== 'string') return;
    else if (value && typeof value === 'string') attributes.push(`${name}=${value}`);
    else attributes.push(name);
  });

  const classNames: string[] = [];

  selector.forEach('class', (classNode) => {
    const className = classNode.first('ident')?.content;

    if (className && typeof className === 'string') classNames.push(className);
  });

  if (classNames.length) attributes.push(`class="${classNames.join(' ')}"`);

  const attributesHtml = (
    attributes.length
    ? ` ${attributes.join(' ')}`
    : ''
  );
  const element: DomNode = [
    `<${tag}${attributesHtml}>`,
    `</${tag}>`,
  ];

  return element;
}



function getSinglelineCommentDomNode (node: Node) {
  if (!node.is('singlelineComment')) return;
  else return Dedent(node.content as string);
}



function getMultilineCommentDomNode (node: Node, marked: Marked) {
  if (!node.is('multilineComment')) return;

  const comment = node.content as string;
  const dedented = Dedent(comment);

  if (comment.indexOf('\n') === -1) return dedented;
  else return marked.parse(dedented) as string;
}



function flatten (domNode: DomNode) {
  const domNodeCopy = domNode.slice();
  let i = 0;

  while (i < domNodeCopy.length)
    if (Array.isArray(domNodeCopy[i]))
      if (
        domNodeCopy[i].length <= 3 &&
        typeof domNodeCopy[i][0] === 'string' &&
        (
          (
            typeof domNodeCopy[i][1] === 'string' &&
            domNodeCopy[i][1].indexOf('\n') === -1
          ) ||
          typeof domNodeCopy[i][1] === 'undefined'
        ) &&
        ['undefined', 'string'].includes(typeof domNodeCopy[i][2])
      ) domNodeCopy.splice(i, 1, (domNodeCopy[i] as string[]).join(''))
      else domNodeCopy.splice(i, 1, ...domNodeCopy[i]);
    else i++;

  return domNodeCopy.join('\n');
}



function recursiveFlatten (domNode: DomNode) {
  const html: string[] = [];

  if (domNode[0] === '') domNode.shift();
  if (domNode[domNode.length - 1] === '') domNode.pop();

  recurse(domNode);

  return html.join('\n');

  function recurse (domNode: DomNode | string, level = 0) {
    const indent = Array(level).fill('  ').join('');

    if (typeof domNode === 'string')
      return html.push(domNode.replace(/^/gm, indent));

    if (
      domNode.length <= 3 &&
      typeof domNode[0] === 'string' &&
      (
        (
          typeof domNode[1] === 'string' &&
          domNode[1].indexOf('\n') === -1
        ) ||
        typeof domNode[1] === 'undefined'
      ) &&
      ['undefined', 'string'].includes(typeof domNode[2])
    ) return html.push(indent + domNode.join(''));

    recurse(domNode[0], level);

    for (let index = 1; index < domNode.length - 1; index++)
      recurse(domNode[index], level + 1);

    if (domNode.length > 2)
      recurse(domNode[domNode.length - 1], level);
  }
}