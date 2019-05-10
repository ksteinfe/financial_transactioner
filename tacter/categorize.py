
import os


def categorize_explicitly(tact, allowed, xfs_cat, xfs_dsc):
    # by category
    if '_catg' in tact:
        if tact['_catg'] in allowed: return tact['_catg']
        if tact['_catg'] in xfs_cat: return xfs_cat[tact['_catg']]

    # by description
    for key, val in xfs_dsc.items():
        if key in tact['desc'].lower(): return val
    #print("could not resolve given category:\t{}".format(given))
    return False


def allowed_categories():
    pth = os.path.join(os.path.dirname(__file__), 'categories_allowed.txt')
    with open(pth) as f:
        content = [y for y in [x.strip() for x in f.readlines()] if y]
        return content

def category_xforms(allowed):
    pth = os.path.join(os.path.dirname(__file__), 'xform_category.txt')
    with open(pth) as f:
        content = [y for y in [x.strip() for x in f.readlines()] if y]
        ret = {}
        for line in content:
            tup = line.split('>')
            if len(tup) != 2:
                print("malformed xform:\t{}".format(line))
                continue
            x,y = tup[0].strip(), tup[1].strip()
            if y not in allowed:
                print("found category xform that calls for non-allowable category:\t{}".format(line))
                continue
            ret[x]=y

        return ret

def description_xforms(allowed):
    pth = os.path.join(os.path.dirname(__file__), 'xform_description.txt')
    with open(pth) as f:
        content = [y for y in [x.strip() for x in f.readlines()] if y]
        ret = {}
        for line in content:
            tup = line.split('>')
            if len(tup) != 2:
                print("malformed xform:\t{}".format(line))
                continue
            x,y = tup[0].strip().lower(), tup[1].strip()
            if y not in allowed:
                print("found description xform that calls for non-allowable category:\t{}".format(line))
                continue
            ret[x]=y

        return ret
