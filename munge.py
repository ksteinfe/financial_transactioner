import os, argparse
from tacter.process_csv import do_process_directory


def main(pth_src):
    print("munging all CSV files found at:\n{}".format(pth_src))
    inference_model_path = os.path.realpath(r".\inference_models\190423\model")
    inference_model_path = False
    do_process_directory(pth_src, inference_model_path)

if __name__ == '__main__':

    """Checks if a path is an actual directory"""
    def is_dir(pth):
        if not os.path.isdir(pth):
            msg = "{0} is not a directory".format(pth)
            raise argparse.ArgumentTypeError(msg)
        else:
            return os.path.abspath(os.path.realpath(os.path.expanduser(pth)))

    # create args parser
    parser = argparse.ArgumentParser()
    parser.add_argument('pth_src', help="Path to a directory containing CSVs to process.", type=is_dir)
    args = parser.parse_args()

    # pth_src = os.path.dirname(os.path.realpath(__file__))
    main(args.pth_src)
