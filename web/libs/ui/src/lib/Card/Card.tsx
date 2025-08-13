import styles from "./Card.module.scss";

type CardProps = {
  header?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  headerLine?: boolean;
  noMargin?: boolean;
};

export const Card = ({ header, extra, headerLine, noMargin, children, style }: CardProps) => {
  const cardClass = [styles.card, noMargin === true ? styles.cardNoMargin : null].filter(Boolean).join(" ");
  const headerClass = [styles.header, headerLine === false ? styles.headerNoUnderline : null].filter(Boolean).join(" ");
  return (
    <div className={cardClass} style={style}>
      {(header || extra) && (
        <div className={headerClass}>
          <div className={styles.headerContent}>{header}</div>

          {extra && <div className={styles.headerExtra}>{extra}</div>}
        </div>
      )}
      <div className={styles.content}>{children}</div>
    </div>
  );
};
