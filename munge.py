import os
from tacter.process_csv import do_process_directory


def main(pth_src):
    print("munging all CSV files found at:\n{}".format(pth_src))
    inference_model_path = r"C:\Users\ksteinfe\Desktop\TEMP\ludwig_finance_training\results\experiment_run_20_07909_accuracy\model"
    #inference_model_path = False
    do_process_directory(pth_src, inference_model_path)

if __name__ == '__main__':
    pth_src = os.path.dirname(os.path.realpath(__file__))
    main(pth_src)
