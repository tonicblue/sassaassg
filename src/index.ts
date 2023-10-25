import FS from 'fs';
import Path from 'path';
import Gonzales, { Node } from 'gonzales-pe';
import { Marked } from 'marked';
import Dedent from 'dedent';

type DomNode = [
  openTag: string,
  ...children: (DomNode | string)[],
  closingTag: string | undefined,
];
type DomNodeStack = [level: number, node: DomNode][];

runTests();

export function runTests () {
  const scssFilesDirectory = Path.join(import.meta.dir, '..', 'scss-tests');
  console.log(`Loading test .scss files from ${scssFilesDirectory}`);

  const scssFiles = FS.readdirSync(scssFilesDirectory);

  for (const [index, scssFile] of Object.entries(scssFiles)) {
    if (!scssFile.endsWith('.scss')) continue;

    const scssFilePath = Path.join(scssFilesDirectory, scssFile);
    parseFile(scssFilePath);
  }
}

export function parseFile (path: string) {
  const scss = FS.readFileSync(path).toString();

  console.log(`Parsing ${path} (${scss.length} bytes)`);
  const [html, ast] = parse(scss);

  const outputHtmlPath = `${path}.html`;
  console.log(`Writing HTML to ${outputHtmlPath} (${html.length} bytes)`);
  FS.writeFileSync(outputHtmlPath, html);

  const outputAstPath = `${path}.json`;
  const astJson = ast.toJson();
  console.log(`Writing AST JSON to ${outputAstPath} (${astJson.length} bytes)`);
  FS.writeFileSync(outputAstPath, astJson);

  return [html, ast];
}

export function parse (scss: string): [string, Node] {
  const ast = Gonzales.parse(scss, { syntax: 'scss' });
  const marked = new Marked();

  const domRoot: DomNode = ['<html>', '</html>'];
  const domNodeStack: DomNodeStack = [[0, domRoot]];

  ast.traverse((node, index, parent, level) => {
    const [parentLevel, parentNode] = domNodeStack[domNodeStack.length - 1];

    const domNode = getDomNode(node);
    if (domNode) {
      parentNode.splice(parentNode.length - 1, 0, domNode);
      domNodeStack.push([level, domNode]);
    }

    if (node.is('multilineComment') || node.is('singlelineComment')) {
      const comment = Dedent(node.content as string);
      const content = (
        comment.indexOf('\n') === -1
          ? comment
          : marked.parse(comment) as string
      );
      parentNode.splice(parentNode.length - 1, 0, content);
    }

    if (level <= parentLevel) domNodeStack.pop();
  });

  const html = flatten(domRoot);

  return [html, ast];
}

function getDomNode (node: Node) {
  if (!node.is('ruleset')) return;

  const selector = node.first('selector');
  const typeSelector = selector?.first('typeSelector');
  const ident = typeSelector?.first('ident');
  const tag = ident?.content as string;

  if (!selector || !typeSelector || ! ident || !tag) return;

  const attributes: string[] = [];

  selector.forEach('attributeSelector', (node, index, parent) => {
    const name = node.first('attributeName')?.first('ident')?.content;
    const value = node.first('attributeValue')?.first('string')?.content;

    if (typeof name !== 'string') return;
    else if (value && typeof value === 'string') attributes.push(`${name}=${value}`);
    else attributes.push(name);
  });

  const classNames: string[] = [];

  selector.forEach('class', (classNode, index, parent) => {
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

function flatten (domNode: DomNode) {
  let i = 0;

  while (i < domNode.length)
    if (Array.isArray(domNode[i]))
      if (domNode[i].length <= 3 && !domNode[i].find((item: any) => typeof item !== 'string'))
        domNode.splice(i, 1, domNode[i].join(''))
      else domNode.splice(i, 1, ...domNode[i]);
    else i++;

  return domNode.join('\n');
}