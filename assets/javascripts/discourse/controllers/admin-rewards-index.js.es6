import Controller from "@ember/controller";
import discourseComputed from "discourse-common/utils/decorators";
import { inject as service } from "@ember/service";
import { action } from "@ember/object";
import showModal from "discourse/lib/show-modal";
import Reward from "../models/reward";
import I18n from "I18n";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default Controller.extend({
  routing: service("-routing"),
  page: 0,
  loading: false,

  init() {
    this._super(...arguments);

    this.messageBus.subscribe(`/u/rewards`, (data) => {
      this.replaceReward(data);
    });
  },

  replaceReward(data) {
    if (data.create || data.destroy || data.update) {
      return;
    }

    let index = this.model.indexOf(
      this.model.find((searchReward) => searchReward.id === data.reward_id)
    );

    if (index < 0) {
      return;
    }

    this.model.removeObject(this.model[index]);
    this.model.splice(index, 0, Reward.createFromJson(data));

    this.set("model", this.model);
  },

  findRewards() {
    if (this.loading || !this.model) {
      return;
    }

    this.set("loading", true);
    this.set("page", this.page + 1);

    ajax("/rewards.json", {
      type: "GET",
      data: { page: this.page },
    })
      .then((result) => {
        this.model.pushObjects(Reward.createFromJson(result));
      })
      .finally(() => this.set("loading", false));
  },

  @action
  loadMore() {
    this.findRewards();
  },

  @discourseComputed("routing.currentRouteName")
  selectedRoute() {
    const currentRoute = this.routing.currentRouteName;
    const showRoute = "adminRewards.show";
    if (currentRoute !== showRoute) {
      return "adminRewards.show";
    } else {
      return this.routing.currentRouteName;
    }
  },

  @action
  addReward() {
    showModal("admin-reward-form", {
      model: {
        reward: null,
        save: this.save,
        destroy: this.destroy,
      },
    });
  },

  @action
  save(reward) {
    if (!this.saving) {
      let fields = [
        "id",
        "title",
        "points",
        "quantity",
        "title",
        "description",
        "upload_id",
        "upload_url",
      ];

      this.set("saving", true);
      this.set("savingStatus", I18n.t("saving"));

      const data = {};

      fields.forEach(function (field) {
        let d;

        d = reward.get(field);

        data[field] = d;
      });

      const newReward = !reward.id;

      return Reward.save(data)
        .then((result) => {
          if (newReward) {
            this.model.unshiftObject(reward);
            this.send("closeModal");
          } else {
            let index = this.model.indexOf(
              this.model.find((searchReward) => searchReward.id === reward.id)
            );
            this.model.removeObject(this.model[index]);
            this.model.splice(index, 0, result);

            this.set("model", this.model);
            this.set("savingStatus", I18n.t("saved"));
            this.send("closeModal");
          }
        })
        .catch(popupAjaxError)
        .finally(() => {
          this.set("saving", false);
          this.set("savingStatus", "");
        });
    }
  },

  @action
  destroy(reward) {
    if (!reward || !reward.id) {
      return;
    }

    return bootbox.confirm(
      I18n.t("admin.rewards.delete_confirm"),
      I18n.t("no_value"),
      I18n.t("yes_value"),
      (result) => {
        if (result) {
          return Reward.destroy(reward)
            .then(() => {
              this.model.removeObject(reward);
              this.set("model", this.model);
              this.send("closeModal");
            })
            .catch(() => {
              bootbox.alert(I18n.t("generic_error"));
            });
        }
      }
    );
  },
});
