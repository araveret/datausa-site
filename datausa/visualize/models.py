import copy, json, requests
from requests.models import RequestEncodingMixin
from config import API
from datausa.consts import COLLECTIONYEARS
from datausa.utils.format import param_format
from datausa.utils.data import year_cache

class Viz(object):
    """A visualization object to be built using D3plus.

    Attributes:
        config (dict): Configuration for D3plus
        data (List[dict]): A list of data dictionary objects that tell D3plus how to load and transform the data needed for the visualization.

    """

    def __init__(self, params, highlight=False, profile=False, select=False, slug=False, topic=False):
        """Initializes a new Viz class.

        Args:
            config (str): The YAML configuration file as one long string.
            profile (Profile): The Profile class instance this Section will be a part of.

        """

        self.highlight = params.pop("highlight", highlight)
        self.profile = profile.attr
        self.select = select
        self.profile_type = profile.attr_type
        self.className = params.pop("class", False)
        self.slug = slug

        # force the data of params into a list
        data = params.pop("data") if isinstance(params["data"], list) else [params.pop("data")]

        # remove sumlevel if it exists
        sumlevel = params.pop("sumlevel", None)

        # loop through each data and append to self.data
        self.data = []
        for d in data:

            # create a new dict containing the 'split' and 'static' params
            data_obj = {
                "join": d.pop("join", None),
                "divide": d.pop("divide", None),
                "map": d.pop("map", None),
                "merge": d.pop("merge", None),
                "split": d.pop("split", None),
                "static": d.pop("static", None),
                "share": d.pop("share", None)
            }

            # Set fallback API params
            d = param_format(d)

            # create the data URL
            p = RequestEncodingMixin._encode_params(d)
            join = "join/" if data_obj["join"] else ""
            data_obj["url"] = "{}/api/{}?{}".format(API, join, p)

            # store the params in the return dict
            data_obj["params"] = d

            # self.data.append(data_obj)

            if "limit" in d and "year" in d and d["year"] == "all":
                for year in year_cache[requests.get(data_obj["url"].replace("/api/", "/api/logic/")).json()["tables"][0]["table"]]:
                    new_obj = copy.deepcopy(data_obj)
                    year = str(int(year))
                    new_obj["url"] = new_obj["url"].replace("year=all", "year={}".format(year))
                    new_obj["params"]["year"] = year
                    self.data.append(new_obj)
            else:
                # append the data dict to self.data
                self.data.append(data_obj)

        self.attrs = []
        if "attrs" in params:
            # force the attrs of params into a list
            attrs = params.pop("attrs") if isinstance(params["attrs"], list) else [params.pop("attrs")]
            # loop through each data and append to self.data
            self.attrs = [{"type": a, "url": "{}/attrs/{}/".format(API, a)} for a in attrs]

        # set self.config to the params
        self.config = params

        if "mouse" in params:
            if params["mouse"] == "NO":
                self.config["mouse"] = False
            else:
                self.config["mouse"] = True

        # set the tooltip config using the function
        self.config["tooltip"] = params.pop("tooltip", {})
        self.config["tooltip"]["value"] = self.tooltip()
        tooltipValues = [];
        if "year" not in tooltipValues:
            tooltipValues.append("year")
        for value in self.config["tooltip"]["value"]:
            tooltipValues.append(value)
            if value in COLLECTIONYEARS:
                tooltipValues.append("{}_collection".format(value))
        self.config["tooltip"]["value"] = tooltipValues

        # set default depth to zero
        self.config["depth"] = int(params["depth"]) if "depth" in params else 0

        # set default text to "name"
        self.config["text"] = params["text"] if "text" in params else "name"

        if topic and "cart" in topic:
            self.cart = topic["cart"]
        else:
            self.cart = False

    def serialize(self):
        """dict: JSON dump of Viz attrs, config, and data """
        return json.dumps({
            "attrs": self.attrs,
            "cart": self.cart,
            "config": self.config,
            "data": self.data,
            "highlight": self.highlight,
            "profile": self.profile,
            "profile_type": self.profile_type,
            "select": self.select,
            "slug": self.slug
        })

    def tooltip(self):
        """List[str]: A list of important data keys to be displayed in tooltips """

        if self.config["tooltip"] and "value" in self.config["tooltip"]:
            return self.config["tooltip"]["value"]

        tooltip = []
        if self.config["type"] == "radar":
            return tooltip

        ids = self.config["id"]
        if not isinstance(ids, list):
            ids = [ids]

        # check each data call for 'required' and 'order'
        forbidden = ["emp_2004_thousands", "emp_2014_thousands", "emp_2024_thousands", "output_2004", "output_2014", "output_2024"]
        for d in self.data:
            p = d["params"]
            for k in ["required", "order"]:
                if k in p:
                    val = p[k].split(",")
                    for v in val:
                        if v != "" and v not in tooltip and v not in forbidden and v not in ids:
                            tooltip.append(v)
                            moe = "{}_moe".format(v)
                            if moe not in tooltip:
                                tooltip.append(moe)
            if d["share"] and "share" not in tooltip:
                share = d["share"].split(".")[0]
                if share not in tooltip:
                    tooltip.append(share)
                    moe = "{}_moe".format(share)
                    if moe not in tooltip:
                        tooltip.append(moe)
                tooltip.append("share")

        # check the config for 'x' 'y' and 'size'
        axis = "y"
        for k in ["x", "y"]:
            if k in self.config:
                val = self.config[k]
                if not isinstance(val, (str, int, float)):
                    if "scale" in val and val["scale"] == "discrete":
                        axis = "x" if k is "y" else "y"

        for k in [axis, "size"]:
            if k in self.config:
                val = self.config[k]
                if not isinstance(val, (str, int, float)):
                    val = val.get("value", False)

                if val and val not in tooltip and val not in forbidden and val not in ids:
                    tooltip.append(val)
                    if k == axis:
                        tooltip.append("{}2_{}".format(axis, val))
                    moe = "{}_moe".format(val)
                    if moe not in tooltip:
                        tooltip.append(moe)

        if "exclude" in self.config["tooltip"]:
            excludes = self.config["tooltip"]["exclude"]
            del self.config["tooltip"]["exclude"]
            if not isinstance(excludes, list):
                excludes = [excludes]
            tooltip = [t for t in tooltip if t not in excludes]

        return tooltip
