import time, os, logging
from datetime import datetime, date
from tacter.account import Account

print("...importing Ludwig")
st = time.time()
from ludwig import LudwigModel
print("...loaded Ludwig in {:.2f}s".format(time.time()-st))


def main():
    pth_mdl = r"C:\Users\ksteinfe\Desktop\TEMP\ludwig_finance_training\results\experiment_run_20_07909_accuracy\model"
    tacts = [
        {"date": date.today(),"amnt": 10,"acnt": Account.BOA_CHECK,"desc": "Paycheck - SOM,Online Banking transfer from CHK 6882 Confirmation# 5464034504"},
        {"date": date.today(),"amnt": -80,"acnt": Account.BOA_CHECK,"desc": "Groceries,CAL-MART SUPER 02/05 #000318605 PURCHASE CAL-MART SUPER 35 SAN FRANCISCO CA"}
    ]
    print(tacts)
    do_inference(pth_mdl, tacts)


def do_inference(pth_mdl, tacts):
    modl = load_model(pth_mdl)
    data_dict = {
        "mnth": ["{:%m}".format(tact['date']) for tact in tacts],
        "day": ["{:%d}".format(tact['date']) for tact in tacts],
        "amnt": [tact['amnt'] for tact in tacts],
        "acnt": [tact['acnt'].value for tact in tacts],
        "desc": [tact['desc'] for tact in tacts],
    }
    results = do_predict(modl, data_dict, 'catg')
    #for r in results: print("{}\t{}".format(r['pred'],r['prob']))
    return results

def load_model(pth_mdl):
    #pth_mdl = os.path.join( config['pth_mdls'], config['model_to_load'], "model")
    if not os.path.isdir(pth_mdl):
        raise Exception("Could not find the model specified in the models directory: {}".format(pth_mdl))

    st = time.time()
    print("...loading model from {}".format(pth_mdl))
    modl = LudwigModel.load(pth_mdl)
    print("...loaded model in {:.2f}s".format(time.time()-st))
    return modl

def do_predict(modl, data_dict, feat_out):
    predictions = modl.predict(
        data_dict=data_dict,
        return_type='dict',
        batch_size=128,
        gpus=None,
        gpu_fraction=1,
        logging_level=logging.ERROR
    )
    return [ {'pred':predictions[feat_out]['predictions'][n], 'prob':predictions[feat_out]['probability'][n], 'probs':predictions[feat_out]['probabilities'][n]} for n in range(len(predictions[feat_out]['predictions']))]

if __name__ == '__main__':
    main()
