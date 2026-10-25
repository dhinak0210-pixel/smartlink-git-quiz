# variant-pipeline/instantiate/constraints.py
"""
Constraint checking utilities for parameter assignments.
"""

def check_constraints(params: dict, constraints: list[str]) -> bool:
    """
    Evaluate constraint expressions against a parameter set.
    """
    if not constraints:
        return True

    def paired(a, b):
        return True

    local_vars = dict(params)
    local_vars['paired'] = paired

    for constraint in constraints:
        try:
            result = eval(constraint, {"__builtins__": {}}, local_vars)
            if not result:
                return False
        except Exception:
            return False

    return True
