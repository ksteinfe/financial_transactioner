from enum import Enum

class Account(Enum):
    BOA_CHECK = "primary_checking" #2955
    BOA_BILLS = "bills_checking" #2232
    BOA_VISA = "boa_visa"
    CHASE = "chase"
    CAP_ONE = "capital_one"
    MINT_HISTORICAL = "mint"
