// Only the PayPal response fields this app actually uses.
// Fields marked "?" can be missing, so the code has to handle that.

export type Money = { currency_code: string; value: string };

export type Link = { href: string; rel: string; method?: string };

export type DisputeSummary = {
  dispute_id: string;
  create_time: string;
  update_time: string;
  reason: string;
  status: string;
  dispute_state?: string;
  dispute_amount: Money;
  dispute_life_cycle_stage: string;
};

export type DisputeList = {
  items?: DisputeSummary[];
  links?: Link[];
};

export type DisputeMessage = {
  posted_by: string; // "BUYER" or "SELLER"
  time_posted: string;
  content: string;
};

export type DisputedTransaction = {
  seller_transaction_id?: string; // the capture ID on our side
  buyer_transaction_id?: string;
  create_time?: string;
  gross_amount?: Money;
  buyer?: { name?: string };
};

export type DisputeDetail = DisputeSummary & {
  disputed_transactions?: DisputedTransaction[];
  messages?: DisputeMessage[];
  seller_response_due_date?: string;
};

export type Capture = {
  id: string;
  status: string;
  amount: Money;
  create_time: string;
  supplementary_data?: { related_ids?: { order_id?: string } };
};

export type Order = {
  id: string;
  status: string;
  create_time?: string;
  purchase_units: { description?: string; amount: Money }[];
};
