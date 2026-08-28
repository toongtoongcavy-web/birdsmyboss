import type { ReactNode } from "react";

export type OrangeRingVariant="compact"|"standard"|"inline"|"selected";
export function OrangeRing({variant="standard",className=""}:{variant?:OrangeRingVariant;className?:string}){
  return <span aria-hidden="true" className={`orange-ring orange-ring--${variant} ${className}`.trim()}/>;
}

export function PairRelationship({leftName,leftIdentifier,rightName,rightIdentifier,compact=false}:{leftName:string;leftIdentifier:string;rightName:string;rightIdentifier:string;compact?:boolean}){
  return <div className={`bmb-pair-relationship${compact?" bmb-pair-relationship--compact":""}`}>
    <span className="bmb-pair-bird"><OrangeRing variant="compact"/><span><small>พ่อนก</small><strong>{leftName}</strong><em>Ring ID: {leftIdentifier}</em></span></span>
    <span className="bmb-pair-link" aria-hidden="true"><i/><b>PAIR</b><i/></span>
    <span className="bmb-pair-bird"><OrangeRing variant="compact"/><span><small>แม่นก</small><strong>{rightName}</strong><em>Ring ID: {rightIdentifier}</em></span></span>
  </div>;
}

export function TrustMarker({children}:{children:ReactNode}){
  return <span className="bmb-marker bmb-marker--trust"><span aria-hidden="true">✓</span>{children}</span>;
}

export function ProvenanceMarker({children}:{children:ReactNode}){
  return <span className="bmb-marker bmb-marker--provenance"><span aria-hidden="true">◆</span>{children}</span>;
}

export function LifecycleEvent({tone,children}:{tone:"hatch"|"sex"|"weight"|"neutral";children:ReactNode}){
  return <article className={`bmb-lifecycle-event bmb-lifecycle-event--${tone}`}>{children}</article>;
}

export function LineageNode({role="parent",title,identifier}:{role?:"parent"|"bird";title:string;identifier?:string}){
  return <article className={`bmb-lineage-node bmb-lineage-node--${role}`}>{role==="bird"&&<OrangeRing variant="compact"/>}<strong>{title}</strong>{identifier&&<small>{identifier}</small>}</article>;
}

export function BmbMetric({label,value,kind="secondary",identity=false}:{label:string;value:ReactNode;kind?:"primary"|"secondary";identity?:boolean}){
  return <article className={`bmb-metric bmb-metric--${kind}`}>{identity&&<OrangeRing variant="inline"/>}<span>{label}</span><strong>{value}</strong></article>;
}

export function OperationalSignal({label,value,tone="information"}:{label:string;value:ReactNode;tone?:"information"|"trust"|"milestone"|"neutral"}){
  return <div className={`bmb-operational-signal bmb-operational-signal--${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

export function SummaryGroup({eyebrow,title,children}:{eyebrow:string;title:string;children:ReactNode}){
  return <section className="bmb-summary-group"><header><small>{eyebrow}</small><h3>{title}</h3></header>{children}</section>;
}
