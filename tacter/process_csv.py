import csv, os, glob
from tacter.categorize import allowed_categories, category_xforms, description_xforms
from tacter.categorize import categorize_explicitly
from tacter.account import Account
from datetime import datetime

def do_process_directory(pth_src, pth_inf_mdl=False):
    # load inference model if path given
    do_infer = False
    if pth_inf_mdl:
        import tacter.infer
        do_infer = True


    # load and determine category of CSV files
    inf_csv = []
    for pth_csv in get_csv_files(pth_src):
        try:
            cat = determine_csv_category(pth_csv)
            strs_csv = False
            with open(pth_csv) as f: strs_csv = f.readlines()
            inf_csv.append((strs_csv,cat,os.path.basename(pth_csv)))
        except Exception as e:
            print("!!! {}\n{}\nSkipping.".format(os.path.basename(pth_csv),e))

    # parse CSV files to transactions
    tacts = []
    for inf in inf_csv:
        tacts.extend( csv_to_tacts(*inf) )
    print("----\nfound {} transactions.".format(len(tacts)))

    cat_alw = allowed_categories()
    xfs_cat = category_xforms(cat_alw)
    xfs_dsc = description_xforms(cat_alw)

    # determine category
    cats = set()
    cats_bad = set()
    tacts_bad = []
    for tact in tacts:
        tact['catg'] = False
        tact['catg'] = categorize_explicitly(tact,cat_alw,xfs_cat,xfs_dsc) # categorize by category or description
        #print(tact['catg'])

        if not tact['catg']:
            g = False
            if '_catg' in tact and tact['_catg']: g = tact['_catg']
            print("could not deterimine category\t{:%d/%m/%y}\t{}\t{}\t{}\t{}".format(tact['date'],tact['amnt'],tact['acnt'],g,tact['desc']))
            if g: cats_bad.add(g)
            tacts_bad.append(tact)
            continue

        cats.add(tact['catg'])
    print("----\n")
    #print("found {} categories of transaction:\n{}".format(len(cats),", ".join(list(cats)) ))
    print("could not explicitly resolve categories for {} transactions".format(len(tacts_bad)))
    print("found {} categories among these transactions that I could not explicitly resolve:\n{}".format(len(cats_bad),", ".join(list(cats_bad))))

    if do_infer:
        print("inferring categories using given infernce model.")
        infrs = tacter.infer.do_inference(pth_inf_mdl, tacts)
        for tact, infr in zip(tacts,infrs):
            tact['pred'] = infr['pred']
            tact['prob'] = infr['prob']

    for f in [item for sublist in [glob.glob(e) for e in ['*predictions.npy', '*probabilities.npy', '*probability.npy']] for item in sublist]:
        print("removing temp npy file: {}".format(f))
        os.remove(f)

    with open('out.csv', 'w', newline='') as f:
        keys = ["date", "amnt", "acnt", "catg", "_catg", "pred", "prob", "desc"]
        tacts_write = [{key: value for key, value in tact.items() if key in keys} for tact in tacts]
        tacts_write = sorted(tacts_write, key = lambda i: i['date'])
        for tact in tacts_write:
            tact['date'] = "{:%m/%d/%Y}".format(tact['date'])
            tact['acnt'] = tact['acnt'].value
            if not tact['catg']: tact['catg'] = "FALSE"
        dict_writer = csv.DictWriter(f, keys)
        dict_writer.writeheader()
        dict_writer.writerows(tacts_write)

def csv_to_tacts(strs, cat, name):
    print("--\tparsing {} as an {}".format(name, cat))

    def amnt_from_fields(d,c):
        amnt = d
        if amnt: amnt = float(amnt) * -1
        else: amnt = float(c)
        return amnt

    def amnt_from_type(a,t):
        amnt = float(a)
        if t == "debit": amnt*=-1
        return amnt

    if cat is Account.BOA_BILLS or cat is Account.BOA_CHECK:
        #print("cutting head")
        strs = strs[6:]

    reader = csv.DictReader(strs)
    #print(reader.fieldnames)
    tacts = []
    for n, row in enumerate(reader):
        tact = False
        if cat is Account.MINT_HISTORICAL:
            amnt = amnt_from_type(row['Amount'], row['Transaction Type'])
            date = datetime.strptime(row['Date'], "%m/%d/%Y")

            acnt = False
            if row['Account Name'].strip().lower()=="credit card": acnt = Account.CAP_ONE
            if row['Account Name'].strip().lower()=="adv tiered interest chkg": acnt = Account.BOA_CHECK
            if row['Account Name'].strip().lower()=="bankamericard rewards visa platinum plus": acnt = Account.BOA_VISA
            if row['Account Name'].strip().lower()=="world mastercard": acnt = Account.BOA_VISA
            if not acnt:
                print("could not determine the proper account for this Mint transaction:\n{}".format(row))

            tact = {
                "date": date,
                "amnt": amnt,
                "acnt": acnt,
                "desc": row['Original Description'],
                "_catg": row['Category'],
                "_desc": row['Description'],
                "_labl": row['Labels'],
                "_note": row['Notes']
            }
            #print(tact)
        if cat is Account.BOA_BILLS or cat is Account.BOA_CHECK:
            if n==0 and row['Description'].startswith('Beginning balance'):
                print("skipping beginning balance transaction.")
                continue
            amnt = float(row['Amount'])
            date = datetime.strptime(row['Date'], "%m/%d/%Y")
            tact = {
                "date": date,
                "amnt": amnt,
                "desc": row['Description']
            }
            #print(tact)
        if cat is Account.CHASE:
            amnt = float(row['Amount'])
            date = datetime.strptime(row['Transaction Date'], "%m/%d/%Y")
            tact = {
                "date": date,
                "amnt": amnt,
                "desc": row['Description'],
                "_catg": row['Category']
            }
            #print(tact)
        if cat is Account.CAP_ONE:
            #print("'{}'\t'{}''".format(row['Debit'],row['Credit']))
            amnt = amnt_from_fields(row['Debit'], row['Credit'])
            date = datetime.strptime(row['Transaction Date'], "%Y-%m-%d")
            tact = {
                "date": date,
                "amnt": amnt,
                "desc": row['Description'],
                "_catg": row['Category']
            }
            #print(tact)

        if cat is Account.BOA_VISA:
            #print("'{}'\t'{}''".format(row['Debit'],row['Credit']))
            amnt = float(row['Amount'])
            date = datetime.strptime(row['Posted Date'], "%m/%d/%Y")
            tact = {
                "date": date,
                "amnt": amnt,
                "desc": row['Payee']
            }
            #print(tact)

        if not tact:
            print("!!! could not parse transaction.")
            continue

        if 'acnt' not in tact: tact['acnt'] = cat
        tacts.append(tact)

    return tacts

def determine_csv_category(pth_csv):
    with open(pth_csv) as f:
        line = f.readline()
        # TODO: this is a stupid fragile way of determining institution
        if line.lower().startswith("transaction date,posted date"): return Account.CAP_ONE
        if line.lower().startswith("transaction date,post date"): return Account.CHASE
        if line.lower().startswith('"date","description"'): return Account.MINT_HISTORICAL
        if line.lower().startswith('posted date,reference number'): return Account.BOA_VISA # what about alaska card??
        if line.lower().startswith("description,,summary"):
            if "2955" in os.path.basename(pth_csv): return Account.BOA_CHECK
            if "2232" in os.path.basename(pth_csv): return Account.BOA_BILLS
            raise ValueError("This looks like a BoA CSV file, but I didn't find any of the account numbers I expected.\nDidn't find 2955 or 2232.")
        raise ValueError("I couldn't deterimine the category of this CSV file\n{}".format(line))

def get_csv_files(pth_src):
    return [ os.path.join(root, file)
        for root, dirs, files in os.walk(pth_src)
        for file in files
        if file.lower().endswith('.csv') and pth_src == root]
