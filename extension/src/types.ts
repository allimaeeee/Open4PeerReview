export type CriterionScore = 'does_not_meet' | 'exemplifies' | 'exceeds';
export type HighlightTag = 'action_item' | 'quick_fix';

export interface TextPositionSelector {
  type: 'TextPositionSelector';
  start: number;
  end: number;
}

export interface TextQuoteSelector {
  type: 'TextQuoteSelector';
  exact: string;
  prefix: string;
  suffix: string;
}

export type AnchorSelector = TextPositionSelector | TextQuoteSelector;

export interface HtmlCharOffsetAnchor {
  type: 'html-char-offset';
  pageIndex: number;
  selector: AnchorSelector[];
}

export interface BboxAnchor {
  type: 'bbox';
  x: number;
  y: number;
  width: number;
  height: number;
  screenshotUrl?: string;
  pageUrl?: string;
  pageName?: string;
  textQuote?: string;
}

export interface PointAnchor {
  type: 'point';
  pageX: number;
  pageY: number;
  relX: number;
  relY: number;
  pageUrl?: string;
  pageName?: string;
}

export type Anchor = HtmlCharOffsetAnchor | BboxAnchor | PointAnchor;

export interface RubricItem {
  id: string;
  rubric_id: string;
  label: string;
  description: string;
  sort_order: number;
}

export interface AnnotationRecord {
  id: string;
  review_id: string;
  rubric_item_id: string | null;
  anchor: Anchor;
  body: string;
  tag: HighlightTag | null;
  created_at: string;
}

export interface ReviewScoreRecord {
  id: string;
  review_id: string;
  rubric_item_id: string;
  score: CriterionScore | null;
  criterion_scores: CriterionScore[] | null;
  comment: string | null;
}

export interface ReviewAssignment {
  id: string;
  document_id: string;
  rubric_id: string;
  status: string;
  documents: { title: string; source_url: string | null } | null;
  rubrics: { title: string } | null;
}

export interface StoredAuth {
  access_token: string;
  refresh_token: string;
  user_id: string;
  email: string;
  expires_at: number;
}

export type BackgroundMessageType =
  | 'CAPTURE_TAB'
  | 'UPLOAD_SCREENSHOT'
  | 'SAVE_ANNOTATION'
  | 'UPDATE_ANNOTATION'
  | 'DELETE_ANNOTATION'
  | 'SAVE_SCORE'
  | 'GET_ASSIGNMENTS'
  | 'GET_RUBRIC_ITEMS'
  | 'GET_ANNOTATIONS'
  | 'GET_SCORES'
  | 'SET_REVIEW_STATUS'
  | 'LOGIN'
  | 'LOGOUT'
  | 'GET_AUTH';

export interface BackgroundMessage {
  type: BackgroundMessageType;
  payload?: Record<string, unknown>;
}

export interface BackgroundResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
