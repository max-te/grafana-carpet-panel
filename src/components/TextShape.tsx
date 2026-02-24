import React from 'react';
import { Shape } from 'react-konva';

type ShapeAttrs = Parameters<typeof Shape>[0];
type SpecificShapeAttrs = {
  // NodeConfig has an annoying `[index: string]: any` which we drop here
  [K in keyof ShapeAttrs as (string extends K ? never : K)]: ShapeAttrs[K]
};

type TextShapeAttrs = {
  text: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  fontFamily: string;
  fontSize: number;
} & Omit<SpecificShapeAttrs, 'sceneFunc'>

export const TextShape: React.FC<TextShapeAttrs> = (props) =>
  <Shape
    sceneFunc={textRenderFunc}
    {...props}
  />

const textRenderFunc: ShapeAttrs['sceneFunc'] = (context, shape) => {
  const attrs = shape.attrs as TextShapeAttrs;
  context.textAlign = attrs.align ?? "left";
  context.textBaseline = attrs.baseline ?? "alphabetic";
  context.font = `${attrs.fontSize}px ${attrs.fontFamily}`;
  context.fillStyle = shape.fill();
  context.fillText(attrs.text, 0, 0, shape.width());
};

