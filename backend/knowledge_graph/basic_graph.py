from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Concept metadata
# ---------------------------------------------------------------------------

_CONCEPTS: dict[str, dict] = {
    "entity_concept": {
        "id": "entity_concept",
        "title": "The Business Entity Concept",
        "type": "principle",
        "description": (
            "A business is treated as a separate entity from its owner(s). "
            "Only transactions that affect the business are recorded in the "
            "business accounts, keeping personal and business finances distinct."
        ),
        "examples": [
            "A sole trader's personal car is not recorded as a business asset.",
            "The owner's home mortgage is excluded from the business balance sheet.",
        ],
        "depends_on": [],
    },
    "accounting_equation": {
        "id": "accounting_equation",
        "title": "The Accounting Equation",
        "type": "principle",
        "description": (
            "Assets = Capital + Liabilities. Every resource owned by the business "
            "(asset) is financed either by the owner (capital) or by external "
            "parties (liabilities). The equation must always balance."
        ),
        "examples": [
            "A business owns $10,000 in assets funded by $6,000 capital and $4,000 bank loan.",
            "Buying inventory on credit increases assets and liabilities by equal amounts.",
        ],
        "depends_on": ["entity_concept"],
    },
    "dual_aspect": {
        "id": "dual_aspect",
        "title": "The Dual Aspect Concept",
        "type": "principle",
        "description": (
            "Every transaction has two equal and opposite effects on the accounting "
            "equation. For every debit there is an equal credit, ensuring the "
            "equation always remains in balance."
        ),
        "examples": [
            "Purchasing equipment for cash: equipment (asset) increases, cash (asset) decreases.",
            "Taking a loan: cash (asset) increases, loan payable (liability) increases.",
        ],
        "depends_on": ["accounting_equation"],
    },
    "debit_credit": {
        "id": "debit_credit",
        "title": "Debits and Credits",
        "type": "mechanic",
        "description": (
            "Debits record increases in assets and expenses, and decreases in "
            "liabilities, capital, and income. Credits do the opposite. "
            "Every transaction requires at least one debit and one matching credit."
        ),
        "examples": [
            "Receiving cash from a customer: debit Cash, credit Revenue.",
            "Paying a supplier: debit Accounts Payable, credit Cash.",
        ],
        "depends_on": ["dual_aspect"],
    },
    "t_account": {
        "id": "t_account",
        "title": "T-Accounts",
        "type": "mechanic",
        "description": (
            "A T-account is the visual representation of a ledger account, shaped "
            "like the letter T. Debits are recorded on the left side and credits on "
            "the right. The balance is the difference between the two sides."
        ),
        "examples": [
            "A Cash T-account with $5,000 on the debit side and $2,000 on the credit side has a $3,000 debit balance.",
            "A Loan T-account accumulates credits as the liability grows.",
        ],
        "depends_on": ["debit_credit"],
    },
    "accrual": {
        "id": "accrual",
        "title": "The Accrual Concept",
        "type": "principle",
        "description": (
            "Income and expenses are recorded when they are earned or incurred, "
            "not when cash is received or paid. This gives a more accurate picture "
            "of financial performance in a given period."
        ),
        "examples": [
            "Revenue earned in December is recorded in December even if cash arrives in January.",
            "An electricity bill received in March covering February is an accrued expense in February.",
        ],
        "depends_on": ["entity_concept"],
    },
    "matching": {
        "id": "matching",
        "title": "The Matching Concept",
        "type": "principle",
        "description": (
            "Expenses should be matched to the revenue they helped generate and "
            "recognised in the same accounting period. This ensures profit is not "
            "overstated or understated in any one period."
        ),
        "examples": [
            "Cost of goods sold is recognised in the same period as the sale, not when inventory was purchased.",
            "Commission paid to a salesperson is expensed in the period the related sale is made.",
        ],
        "depends_on": ["accrual"],
    },
    "going_concern": {
        "id": "going_concern",
        "title": "The Going Concern Concept",
        "type": "principle",
        "description": (
            "A business is assumed to continue operating indefinitely into the foreseeable "
            "future. Assets are therefore valued at cost rather than break-up value, and "
            "long-term liabilities are not treated as immediately due."
        ),
        "examples": [
            "A machine worth $10,000 at cost is not written down to scrap value just because the market is slow.",
            "A 5-year loan is shown as long-term on the balance sheet, not reclassified as current.",
        ],
        "depends_on": ["entity_concept"],
    },
    "historical_cost": {
        "id": "historical_cost",
        "title": "The Historical Cost Concept",
        "type": "principle",
        "description": (
            "Assets are recorded at their original purchase price (historical cost) and "
            "not adjusted for subsequent changes in market value. This provides objectivity "
            "and verifiability in financial records."
        ),
        "examples": [
            "Land bought for $50,000 ten years ago is still carried at $50,000, even if its market value has doubled.",
            "Inventory is recorded at what it cost to acquire, not at its current selling price.",
        ],
        "depends_on": ["entity_concept"],
    },
    "prudence": {
        "id": "prudence",
        "title": "The Prudence Concept",
        "type": "principle",
        "description": (
            "Revenues and profits should only be recognised when realised; losses and "
            "liabilities should be recognised as soon as they are foreseeable. When in "
            "doubt, choose the option that is less likely to overstate assets or income."
        ),
        "examples": [
            "A doubtful debt is written off immediately even though the customer has not yet defaulted.",
            "Inventory is valued at the lower of cost or net realisable value.",
        ],
        "depends_on": ["accrual"],
    },
    "consistency": {
        "id": "consistency",
        "title": "The Consistency Concept",
        "type": "convention",
        "description": (
            "The same accounting methods and policies should be applied from one period "
            "to the next. Changes in method distort comparisons and must be disclosed "
            "with the reason and effect of the change."
        ),
        "examples": [
            "If straight-line depreciation is used in year 1, it should be used in year 2 and beyond.",
            "Switching inventory valuation from FIFO to weighted average requires disclosure and justification.",
        ],
        "depends_on": ["entity_concept"],
    },
    "materiality": {
        "id": "materiality",
        "title": "The Materiality Concept",
        "type": "convention",
        "description": (
            "Only items that are significant enough to influence the decisions of a user "
            "of the financial statements need to be separately disclosed. Immaterial items "
            "may be aggregated or expensed immediately for convenience."
        ),
        "examples": [
            "A $5 stapler is expensed immediately rather than capitalised as a fixed asset.",
            "A $2 million contingent liability must be disclosed; a $20 one need not be.",
        ],
        "depends_on": ["entity_concept"],
    },
    "trial_balance": {
        "id": "trial_balance",
        "title": "The Trial Balance",
        "type": "mechanic",
        "description": (
            "A trial balance is a list of all ledger account balances at a point in time. "
            "Total debits must equal total credits. It is used to check for arithmetic errors "
            "before preparing the final financial statements."
        ),
        "examples": [
            "All debit balances (assets, expenses) and credit balances (liabilities, income, capital) are listed and summed.",
            "If totals do not agree, a transposition or omission error has occurred.",
        ],
        "depends_on": ["t_account"],
    },
    "depreciation": {
        "id": "depreciation",
        "title": "Depreciation",
        "type": "mechanic",
        "description": (
            "Depreciation spreads the cost of a fixed asset over its expected useful life. "
            "It applies the matching concept by charging a portion of the asset's cost as "
            "an expense in each period it contributes to revenue generation."
        ),
        "examples": [
            "A vehicle costing $20,000 with a 5-year life and zero residual value is depreciated at $4,000 per year (straight-line).",
            "Reducing balance: 20% on a $10,000 machine gives $2,000 in year 1, $1,600 in year 2.",
        ],
        "depends_on": ["historical_cost", "matching"],
    },
        # ---------------------------------------------------------------------------
    # Neural Networks & Machine Learning Concepts
    # ---------------------------------------------------------------------------

    "linear_model": {
        "id": "linear_model",
        "title": "Linear Models",
        "type": "model",
        "description": (
            "A linear model predicts outputs as a weighted sum of input features. "
            "It assumes a linear relationship between input variables and output."
        ),
        "examples": [
            "Linear regression predicting house prices.",
            "Binary classification using a linear decision boundary."
        ],
        "depends_on": [],
    },

    "perceptron": {
        "id": "perceptron",
        "title": "The Perceptron",
        "type": "model",
        "description": (
            "A perceptron is a single-layer binary classifier that computes a weighted "
            "sum of inputs followed by a step activation function. It can only classify "
            "linearly separable data."
        ),
        "examples": [
            "Spam vs not spam classification.",
            "Separating two classes using a straight line."
        ],
        "depends_on": ["linear_model"],
    },

    "activation_function": {
        "id": "activation_function",
        "title": "Activation Functions",
        "type": "mechanic",
        "description": (
            "Activation functions introduce non-linearity into neural networks. "
            "Without them, multiple layers collapse into a single linear transformation."
        ),
        "examples": [
            "ReLU outputs max(0, x).",
            "Sigmoid squashes values between 0 and 1.",
            "Tanh outputs values between -1 and 1."
        ],
        "depends_on": ["perceptron"],
    },

    "neuron": {
        "id": "neuron",
        "title": "Artificial Neuron",
        "type": "mechanic",
        "description": (
            "An artificial neuron computes a weighted sum of inputs, adds a bias, "
            "and applies an activation function."
        ),
        "examples": [
            "y = ReLU(w1x1 + w2x2 + b)."
        ],
        "depends_on": ["activation_function"],
    },

    "neural_network": {
        "id": "neural_network",
        "title": "Neural Networks",
        "type": "model",
        "description": (
            "A neural network consists of layers of interconnected neurons. "
            "Each layer transforms inputs through weighted connections and activation functions."
        ),
        "examples": [
            "A feedforward network for digit classification.",
            "A regression network predicting stock prices."
        ],
        "depends_on": ["neuron"],
    },

    "feedforward_network": {
        "id": "feedforward_network",
        "title": "Feedforward Neural Network",
        "type": "model",
        "description": (
            "A feedforward neural network passes information in one direction "
            "from input to output without cycles."
        ),
        "examples": [
            "A 3-layer network used for image classification."
        ],
        "depends_on": ["neural_network"],
    },

    "loss_function": {
        "id": "loss_function",
        "title": "Loss Function",
        "type": "mechanic",
        "description": (
            "A loss function measures how far a model’s predictions are from the true values. "
            "Training aims to minimize this loss."
        ),
        "examples": [
            "Mean Squared Error for regression.",
            "Cross-Entropy Loss for classification."
        ],
        "depends_on": ["neural_network"],
    },

    "gradient": {
        "id": "gradient",
        "title": "Gradient",
        "type": "mathematical_concept",
        "description": (
            "The gradient is the vector of partial derivatives of a function. "
            "It points in the direction of steepest increase."
        ),
        "examples": [
            "Derivative of loss with respect to weights."
        ],
        "depends_on": [],
    },

    "gradient_descent": {
        "id": "gradient_descent",
        "title": "Gradient Descent",
        "type": "optimization",
        "description": (
            "Gradient descent is an optimization algorithm that updates model parameters "
            "in the direction opposite to the gradient to minimize loss."
        ),
        "examples": [
            "w = w - learning_rate * gradient."
        ],
        "depends_on": ["loss_function", "gradient"],
    },

    "backpropagation": {
        "id": "backpropagation",
        "title": "Backpropagation",
        "type": "mechanic",
        "description": (
            "Backpropagation computes gradients efficiently using the chain rule, "
            "allowing multi-layer neural networks to be trained."
        ),
        "examples": [
            "Computing hidden layer gradients using output error."
        ],
        "depends_on": ["gradient_descent", "neural_network"],
    },

    "learning_rate": {
        "id": "learning_rate",
        "title": "Learning Rate",
        "type": "hyperparameter",
        "description": (
            "The learning rate controls the step size taken during gradient descent updates."
        ),
        "examples": [
            "A high learning rate may cause divergence.",
            "A very low learning rate slows convergence."
        ],
        "depends_on": ["gradient_descent"],
    },

    "overfitting": {
        "id": "overfitting",
        "title": "Overfitting",
        "type": "concept",
        "description": (
            "Overfitting occurs when a model memorizes training data instead of learning "
            "general patterns, leading to poor generalization."
        ),
        "examples": [
            "High training accuracy, low validation accuracy."
        ],
        "depends_on": ["neural_network"],
    },

    "underfitting": {
        "id": "underfitting",
        "title": "Underfitting",
        "type": "concept",
        "description": (
            "Underfitting occurs when a model is too simple to capture patterns in data."
        ),
        "examples": [
            "Linear model applied to complex nonlinear data."
        ],
        "depends_on": ["neural_network"],
    },

    "regularization": {
        "id": "regularization",
        "title": "Regularization",
        "type": "mechanic",
        "description": (
            "Regularization techniques reduce overfitting by penalizing model complexity."
        ),
        "examples": [
            "L2 regularization.",
            "Dropout in neural networks."
        ],
        "depends_on": ["overfitting"],
    },

    "dropout": {
        "id": "dropout",
        "title": "Dropout",
        "type": "mechanic",
        "description": (
            "Dropout randomly disables neurons during training to prevent co-adaptation "
            "and reduce overfitting."
        ),
        "examples": [
            "Applying 0.5 dropout during training."
        ],
        "depends_on": ["regularization"],
    },

    "batch_normalization": {
        "id": "batch_normalization",
        "title": "Batch Normalization",
        "type": "mechanic",
        "description": (
            "Batch normalization normalizes activations within a layer to stabilize "
            "and accelerate training."
        ),
        "examples": [
            "Normalizing layer outputs before activation."
        ],
        "depends_on": ["neural_network"],
    },

    "convolutional_neural_network": {
        "id": "convolutional_neural_network",
        "title": "Convolutional Neural Network",
        "type": "model",
        "description": (
            "A CNN is a neural network architecture specialized for grid-like data "
            "such as images, using convolutional layers to extract spatial features."
        ),
        "examples": [
            "Image classification with convolution layers."
        ],
        "depends_on": ["neural_network"],
    },

    "recurrent_neural_network": {
        "id": "recurrent_neural_network",
        "title": "Recurrent Neural Network",
        "type": "model",
        "description": (
            "An RNN processes sequential data by maintaining a hidden state "
            "that captures previous information."
        ),
        "examples": [
            "Language modeling using sequence data."
        ],
        "depends_on": ["neural_network"],
    },
}

# ---------------------------------------------------------------------------
# Topic definitions — concept IDs listed in pedagogical order
# ---------------------------------------------------------------------------

_TOPICS: dict[str, list[str]] = {
    "accounts_unit_2": [
        "entity_concept",
        "accounting_equation",
        "accrual",
        "matching",
    ],
    "double_aspect": [
        "entity_concept",
        "accounting_equation",
        "dual_aspect",
        "debit_credit",
        "t_account",
    ],
    # Eight fundamental accounting principles in dependency order
    "accounting_principles": [
        "entity_concept",
        "going_concern",
        "historical_cost",
        "consistency",
        "materiality",
        "accrual",
        "matching",
        "prudence",
    ],
    # From entity concept through to trial balance
    "ledger_accounts": [
        "entity_concept",
        "accounting_equation",
        "dual_aspect",
        "debit_credit",
        "t_account",
        "trial_balance",
    ],
    # Fixed asset costing: builds on historical cost and matching
    "depreciation_unit": [
        "entity_concept",
        "historical_cost",
        "accrual",
        "matching",
        "depreciation",
    ],
    # Neural Network & ML Topics
    "ml_foundations": [
        "linear_model",
        "gradient"
    ],

    "perceptron_unit": [
        "linear_model",
        "perceptron",
        "activation_function"
    ],

    "neural_network_basics": [
        "perceptron",
        "activation_function",
        "neuron",
        "neural_network",
        "feedforward_network"
    ],

    "training_neural_networks": [
        "loss_function",
        "gradient",
        "gradient_descent",
        "learning_rate",
        "backpropagation"
    ],

    "model_generalization": [
        "neural_network",
        "overfitting",
        "underfitting",
        "regularization",
        "dropout"
    ],

    "advanced_architectures": [
        "convolutional_neural_network",
        "recurrent_neural_network",
        "batch_normalization"
    ],

    "deep_learning_complete_path": [
        "linear_model",
        "perceptron",
        "activation_function",
        "neuron",
        "neural_network",
        "loss_function",
        "gradient",
        "gradient_descent",
        "backpropagation",
        "learning_rate",
        "overfitting",
        "regularization",
        "dropout",
        "batch_normalization",
        "convolutional_neural_network",
        "recurrent_neural_network"
    ]
}

# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

class BasicGraph:
    def get_topic_concepts(self, topic_name: str) -> list[str]:
        if topic_name in _TOPICS:
            return list(_TOPICS[topic_name])

        normalized = _normalize_topic_name(topic_name)
        if normalized in _TOPICS:
            return list(_TOPICS[normalized])

        normalized_no_underscore = normalized.replace("_", "")
        for key in _TOPICS:
            if key.replace("_", "") == normalized_no_underscore:
                return list(_TOPICS[key])

        # Partial token match — a query token and a topic-key token share a stem prefix
        tokens = [t for t in normalized.split("_") if t]
        for token in tokens:
            for key in _TOPICS:
                for key_token in key.split("_"):
                    if token.startswith(key_token) or key_token.startswith(token):
                        return list(_TOPICS[key])

        # Concept-name match — query tokens match concept IDs; find the topic containing them
        for token in tokens:
            for concept_id in _CONCEPTS:
                if token.startswith(concept_id) or concept_id.startswith(token):
                    for key, concept_list in _TOPICS.items():
                        if concept_id in concept_list:
                            return list(_TOPICS[key])

        available = ", ".join(sorted(_TOPICS))
        raise KeyError(f"Unknown topic: '{topic_name}'. Available topics: {available}")

    def get_concept_metadata(self, concept_id: str) -> dict:
        if concept_id not in _CONCEPTS:
            raise KeyError(f"Unknown concept: '{concept_id}'")
        concept = _CONCEPTS[concept_id]
        return {
            "id": concept["id"],
            "title": concept["title"],
            "type": concept["type"],
            "description": concept["description"],
            "examples": list(concept["examples"]),
            "depends_on": list(concept["depends_on"]),
        }

    # ------------------------------------------------------------------
    # New: graph depth computation
    # ------------------------------------------------------------------

    def compute_depth(self, concept_id: str) -> int:
        """
        Return the dependency depth of a concept.

        Depth 0  — root concept with no dependencies.
        Depth N  — 1 + max depth of all direct dependencies.
        """
        return _compute_depth(concept_id)

    def sort_by_depth(self, concept_ids: list[str]) -> list[str]:
        """Return concept_ids sorted foundational → advanced (stable sort)."""
        return sorted(concept_ids, key=lambda cid: _compute_depth(cid))

    # ------------------------------------------------------------------
    # New: deterministic prerequisite resolution
    # ------------------------------------------------------------------

    def resolve_learning_path(
        self,
        target_concept: str,
        user_graph=None,
        mastery_threshold: float = 0.6,
    ) -> list[str]:
        """
        Return the ordered list of concepts needed before (and including)
        target_concept, restricted to those whose effective mastery is below
        mastery_threshold.

        Order: foundational first (increasing depth), target last.
        Purely graph-based — no LLM involvement.
        """
        if target_concept not in _CONCEPTS:
            raise KeyError(f"Unknown concept: '{target_concept}'")

        visited: set[str] = set()
        _collect_prerequisites(target_concept, visited)

        candidates = list(visited)

        if user_graph is not None:
            candidates = [
                cid for cid in candidates
                if user_graph.get_effective_mastery(cid) < mastery_threshold
            ]

        return self.sort_by_depth(candidates)

    def get_prerequisites(self, concept_id: str) -> list[str]:
        """Return direct (non-transitive) prerequisites for a concept."""
        if concept_id not in _CONCEPTS:
            raise KeyError(f"Unknown concept: '{concept_id}'")
        return list(_CONCEPTS[concept_id]["depends_on"])

    def get_all_prerequisites(self, concept_id: str) -> list[str]:
        """Return all transitive prerequisites (excluding concept_id itself),
        sorted foundational → advanced."""
        if concept_id not in _CONCEPTS:
            raise KeyError(f"Unknown concept: '{concept_id}'")
        visited: set[str] = set()
        _collect_prerequisites(concept_id, visited)
        visited.discard(concept_id)
        return self.sort_by_depth(list(visited))


    def list_topics(self) -> dict[str, list[str]]:
        """Return a copy of all topic mappings."""
        return {key: list(value) for key, value in _TOPICS.items()}

    def list_concepts(self) -> list[dict]:
        """Return metadata for all concepts."""
        return [self.get_concept_metadata(cid) for cid in _CONCEPTS.keys()]


# ---------------------------------------------------------------------------
# Internal graph helpers
# ---------------------------------------------------------------------------

def _collect_prerequisites(concept_id: str, visited: set[str]) -> None:
    """DFS — collect concept_id and all transitive dependencies."""
    if concept_id in visited:
        return
    visited.add(concept_id)
    for dep in _CONCEPTS.get(concept_id, {}).get("depends_on", []):
        _collect_prerequisites(dep, visited)


_DEPTH_CACHE: dict[str, int] = {}


def _compute_depth(concept_id: str) -> int:
    """Recursively compute concept depth with module-level memoisation."""
    if concept_id in _DEPTH_CACHE:
        return _DEPTH_CACHE[concept_id]
    deps = _CONCEPTS.get(concept_id, {}).get("depends_on", [])
    depth = 0 if not deps else 1 + max(_compute_depth(d) for d in deps)
    _DEPTH_CACHE[concept_id] = depth
    return depth


_STOP_WORDS = {
    "a",
    "about",
    "an",
    "explain",
    "learn",
    "me",
    "please",
    "teach",
    "the",
}


def _normalize_topic_name(topic_name: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", " ", topic_name.lower()).strip()
    if not cleaned:
        return ""

    tokens = [token for token in cleaned.split() if token not in _STOP_WORDS]
    if not tokens:
        tokens = cleaned.split()

    return "_".join(tokens)
