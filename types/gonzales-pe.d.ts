declare module 'gonzales-pe' {
  export function parse(scss: string, options: any): Node;
  export type Position = {
    column: number,
    line: number
  };
  export type NodeContent = string | number | Node | Node[];
  export type EachForCallback = (node: Node, index: number, parent: Node) => void;
  export type TraverseCallback = (node: Node, index: number, parent: Node, level: number) => void;
  export type TraverseByTypeCallback = (node: Node, index: number, parent: Node) => void;
  export type NodeLike = {
    content: NodeContent,
    end: Position,
    start: Position,
    type: String,
    syntax: 'scss',
  }
  export type Node = NodeLike & {
    contains(type: string): boolean,
    eachFor(type: string | EachForCallback, callback?: EachForCallback): void,
    first(type?: string): Node | null,
    forEach(type: string | EachForCallback, callback?: EachForCallback): void,
    get(index: number): Node | null,
    insert(index: number, node: NodeLike): void,
    is(type: string): boolean,
    last(type?: string): Node | null,
    removeChild(index: number): Node | null,
    toJson(): string,
    toString(): string,
    traverse(callback: TraverseCallback): void,
    traverseByType(type: string, callback: TraverseByTypeCallback): void,
    traverseByTypes(types: string[], callback: TraverseByTypeCallback): void
  };
};