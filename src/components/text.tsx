import type { HTMLAttributes, ReactNode } from 'react';
type TextProps = Omit<HTMLAttributes<HTMLElement>, 'lang'> & {
  as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'strong' | 'small';
  children: ReactNode;
};
function Text({
  as: Tag = 'span',
  children,
  className = '',
  language,
  ...props
}: TextProps & { language: 'vi' | 'ja' }) {
  return (
    <Tag {...props} lang={language} className={`text-${language} ${className}`.trim()}>
      {typeof children === 'string' ? children.normalize('NFC') : children}
    </Tag>
  );
}
export function ViText(props: TextProps) {
  return <Text {...props} language="vi" />;
}
export function JaText(props: TextProps) {
  return <Text {...props} language="ja" />;
}
