import React, { Component } from 'react';
import {CardElement, injectStripe, Elements, StripeProvider} from 'react-stripe-elements';

import Loading, {withLoading} from './Loading';
import CheckoutForm from './CheckoutForm'
import OrderComplete from './OrderComplete'
import ZinesTable from './ZinesTable'
import SavedCardsList from './SavedCardsList'

class Shop extends Component  {
	constructor(props) {
    super(props);
    this.state = this.initialState()
  }

  initialState() {
    return {
      selectedItem: null,

      paymentIntent: null,
      intentActionInProgress: null,
      fulfillmentURL: null,

      error: null,
      checkoutDone: false,
    };
  }

  loadZineById(id) {
  	return this.props.data.find((z) => {
  		return z.id == id
  	})
  }

  createOrder(id) {
    this.createPaymentIntent(id, function() {
      this.setState({
        selectedItem: id,
      })
    }.bind(this));
  }

  cancelOrder() {
    this.setState({
      selectedItem: null,
    }, function() {
      this.cancelPaymentIntent(this.state.paymentIntent.id, function() {})
    }.bind(this));
  }

  saveCard() {
    this.createSetupIntent(function () {
      this.setState({
        savingCard: true,
      })
    }.bind(this))
  }

  doAPIPostRequest(url, params, callback) {
    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })
    .then(function(response) {
      if (!response.ok) {
        throw Error(response.statusText);
      }
      return response
    })
    .then(function(response) {
      return response.json()
    })
    .then(function(data) {
      callback(data);
    })
    .catch(function(err) {
      this.setState({
        error: err,
      })
    }.bind(this))
  }

	createPaymentIntent(zineID, callback) {
    var params = {
      zine: zineID,
    }
    if (this.props.customer) {
      params.customer = this.props.customer.id
    }

    this.setState({
      intentActionInProgress: 'creating payment',
    })
    this.doAPIPostRequest('/api/create_payment_intent', params, function(data) {
      this.setState(
        {
          intentActionInProgress: null,
          paymentIntent: {
            id: data.id,
            clientSecret: data.client_secret,
          }
        },
        callback,
      )
    }.bind(this))
	}

	cancelPaymentIntent(id, callback) {
		this.setState({
			intentActionInProgress: 'canceling payment',
		})
    this.doAPIPostRequest('/api/cancel_payment_intent', {
      id: id,
    }, function(data) {
      this.setState(
        {
          intentActionInProgress: null,
          paymentIntent: null,
        },
        callback,
      )
    }.bind(this))
	}

  finalizePaymentIntent(id, callback) {
    this.setState({
      intentActionInProgress: 'finalizing payment',
    })
    this.doAPIPostRequest('/api/finalize_payment_intent', {
      id: id,
    }, function(data) {
      this.setState(
        {
          intentActionInProgress: null,
          fulfillmentURL: data.fulfillment_url,
        },
        callback,
      )
    }.bind(this))
  }

  createSetupIntent(callback) {
    this.setState({
      intentActionInProgress: 'creating setup',
    })
    this.doAPIPostRequest('/api/create_setup_intent', {}, function(data) {
      this.setState(
        {
          intentActionInProgress: null,
          setupIntent: {
            id: data.id,
            clientSecret: data.client_secret,
          }
        },
        callback,
      )
    }.bind(this))
  }

  setupSuccess(setupIntent) {
    console.log(setupIntent)
    this.setState({
      savingCard: false,
    })
  }

  cancelSetup() {
    this.setState({
      savingCard: false,
    })
  }

	checkoutSuccess() {
    this.finalizePaymentIntent(this.state.paymentIntent.id, function() {
      this.setState({
        checkoutDone: true,
      })
    }.bind(this))
	}

  render() {
  	if (this.state.error != null) {
      return (
      	<div class="alert-danger">
      		<div>{this.state.intentActionInProgress} intent</div>
	        {this.state.error.toString()}
	      </div>
	    )
  	}

  	if (this.state.intentActionInProgress !== null) {
  		return (
  			<div>
  				<span>{this.state.intentActionInProgress} intent</span>
  				<Loading maxTicks={4} interval={250} />
  			</div>
  		)
  	}

  	if (this.state.checkoutDone) {
  		return <OrderComplete
        zine={this.loadZineById(this.state.selectedItem)}
        paymentIntent={this.state.paymentIntent}
        fulfillmentURL={this.state.fulfillmentURL}
      />
  	}

	  return (
	    <div>
	    	{(this.state.selectedItem === null && !this.state.savingCard) &&
		    	<div>
            {this.props.customer &&
              <div>
                <SavedCardsList
                  customer={this.props.customer}
                  showUse={false}
                  onUse={null}
                />

                <button onClick={this.saveCard.bind(this)}>
                  Save new card
                </button>
              </div>
            }

		    		<h4>Things to buy:</h4>
		    		<ZinesTable
              zines={this.props.data}
              action="Buy"
              onClick={this.createOrder.bind(this)}
            />
		    	</div>
		    }

        {this.state.savingCard &&
          <div>
            <Elements>
              <CheckoutForm
                saveCardOnly={true}
                setupIntent={this.state.setupIntent}
                onComplete={this.setupSuccess.bind(this)}
                onCancel={this.cancelSetup.bind(this)}
                customer={this.props.customer}
              />
            </Elements>
          </div>
        }

	    	{this.state.selectedItem !== null &&
		      	<div>
			      	<Elements>
			      		<CheckoutForm
                  zine={this.loadZineById(this.state.selectedItem)}
			      			paymentIntent={this.state.paymentIntent}
			      			onComplete={this.checkoutSuccess.bind(this)}
                  onCancel={this.cancelOrder.bind(this)}
                  customer={this.props.customer}
			      		/>
		        	</Elements>
	        	</div>
      	}
	    </div>
	  );
	}
}

export default withLoading(Shop, "/api/zines");
